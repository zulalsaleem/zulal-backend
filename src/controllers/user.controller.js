import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiErrors } from "../utils/ApiErrors.js";
import { User } from "../models/user.model.js";
import { uploadonCloudinary } from "../utils/cloudinary.js";
import { ApiResponce } from "../utils/ApiRespnce.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        console.error("Error generating tokens:", error);
        throw new ApiErrors(500, "Something went wrong while generating tokens");
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const { username, fullName, email, password } = req.body;
    console.log("email :", email);

    if ([username, email, password, fullName].some((field) => !field || field?.trim() === "")) {
        throw new ApiErrors(400, "Required fields are missing");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ApiErrors(400, "Invalid email format");
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });
    if (existedUser) {
        throw new ApiErrors(409, "User already exists");
    }

    console.log(req.files);

    const avatarLocalpath = req.files?.avatar?.[0]?.path;

    let coverImagelocalpath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImagelocalpath = req.files.coverImage[0].path;
    }

    if (!avatarLocalpath) {
        throw new ApiErrors(400, "Avatar is required");
    }

    const avatar = await uploadonCloudinary(avatarLocalpath);
    const coverImage = await uploadonCloudinary(coverImagelocalpath);

    if (!avatar) {
        throw new ApiErrors(500, "Avatar upload failed");
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    if (!createdUser) {
        throw new ApiErrors(500, "User creation failed");
    }

    return res.status(201).json(
        new ApiResponce(200, createdUser, "User created successfully")
    );
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // FIX 1: email field accepts both email and username from frontend
    if (!email) {
        throw new ApiErrors(400, "Email or username is required");
    }
    if (!password) {
        throw new ApiErrors(400, "Password is required");
    }

    // FIX 2: search by both email AND username fields using the same input
    const user = await User.findOne({
        $or: [
            { email: email },
            { username: email }
        ]
    });

    if (!user) {
        throw new ApiErrors(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiErrors(401, "Invalid password");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    // FIX 3: secure:false on localhost so cookies actually work
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    };

    return res
        .status(200)
        .cookie("refreshToken", refreshToken, options)  // FIX 4: consistent casing
        .cookie("accessToken", accessToken, options)
        .json(
            new ApiResponce(200,
                { user: loggedInUser, accessToken, refreshToken },
                "User logged in successfully"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: { refreshToken: 1 }
        },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"  // FIX: consistent with login
    };

    return res
        .status(200)
        .clearCookie("refreshToken", options)  // FIX 5: was lowercase 't' before
        .clearCookie("accessToken", options)
        .json(new ApiResponce(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiErrors(401, "Unauthorized access");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiErrors(404, "Invalid refresh token");
        }
        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiErrors(401, "Refresh token is expired or used");
        }

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production"
        };

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshToken(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)  // FIX 6: was newrefreshToken (wrong case)
            .json(
                new ApiResponce(200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed successfully"
                )
            );
    } catch (error) {
        throw new ApiErrors(401, error?.message || "Invalid refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiErrors(400, "Invalid old password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponce(200, {}, "Password changed successfully")); // FIX 7: was malformed
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponce(200, req.user, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new ApiErrors(400, "All fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: { fullName, email }
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponce(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarlocalpath = req.file?.path;

    if (!avatarlocalpath) {
        throw new ApiErrors(400, "Avatar file is missing"); // FIX 8: was 4000 status code
    }

    const avatar = await uploadonCloudinary(avatarlocalpath);
    if (!avatar.url) {
        throw new ApiErrors(400, "Error while uploading avatar");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { avatar: avatar.url } },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponce(200, user, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImagelocalpath = req.file?.path;

    if (!coverImagelocalpath) {
        throw new ApiErrors(400, "Cover image file is missing");
    }

    const coverImage = await uploadonCloudinary(coverImagelocalpath);
    if (!coverImage.url) {
        throw new ApiErrors(400, "Error while uploading cover image");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { coverImage: coverImage.url } },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponce(200, user, "Cover image updated successfully"));
});

const getUserChannnelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiErrors(400, "Username is missing");
    }

    const channel = await User.aggregate([
        { $match: { username: username?.toLowerCase() } },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: { $size: "$subscribers" },
                subscribedToChannelCount: { $size: "$subscribedTo" },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscriberCount: 1,
                subscribedToChannelCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ]);

    if (!channel?.length) {
        throw new ApiErrors(404, "Channel does not exist");
    }

    return res
        .status(200)
        .json(new ApiResponce(200, channel[0], "User channel fetched successfully"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(req.user._id) }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",   // FIX 9: was "user" should be "users" (MongoDB collection name)
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: { $first: "$owner" }
                        }
                    }
                ]
            }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponce(200, user[0].watchHistory, "Watch history fetched successfully"));
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannnelProfile,
    getWatchHistory
};