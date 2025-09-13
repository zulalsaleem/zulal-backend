
import { asyncHandler }from "../utils/asyncHandler.js";
import {ApiErrors} from "../utils/ApiErrors.js";
import {User} from "../models/user.model.js";
import {uploadonCloudinary} from "../utils/cloudinary.js";
import { ApiResponce } from "../utils/ApiRespnce.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken =async(userId)=>{
    try {
        const user = await User.findById(userId)

        const accessToken =user.generateAccessToken()
        const refreshToken =await user.generateRefreshToken()

        //console.log("Generated refreshToken:", refreshToken) // Debugging line to check the generated refresh token
        user.refreshToken=refreshToken
        await user.save({validateBeforeSave :false})

        return{accessToken,refreshToken}

    } catch (error) {
        console.error("Error generating tokens:", error)
        throw error;
        //throw new ApiErrors(500,"something went wrong WHILE GENERATING REFRESH AND ACESS TOKEN ")
    }
}

const registerUser=asyncHandler(async(req,res) =>{
    // get user details from front end 
    // validation  - not empty
    // check if user is already exists : username ,email
    // check for images ,check for avatar 
    // upload them cloudinary, avatarnpm run dev
    // crate user objects  - create entry in db 
    // remove password and refresh token filed from response  
    // check for user creation 
    // return response

    const {username,fullName,email,password} =req.body  // destructuring user details from req body
    console.log("email :",email);
    
    if (
        [username, email, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiErrors(400, ["Required fields are missing"]);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)){
        throw new ApiErrors(400,"Invalid email format");
    }

    const existedUser =await User.findOne({       //validation for existing user
        $or : [
            {username},
            {email}
        ]
    });
    if (existedUser) {
        throw new ApiErrors(409,"User already exists")
    }
    console.log(req.files);
    // handle file upload
    // upload to cloudinary 
    // get the url of uploaded image
    const avatarLocalpath = req.files?.avatar[0]?.path;
    //const coverImagelocalpath  = req.files?.coverImage[0]?.path;

    let  coverImagelocalpath;
      if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length >0) {
          coverImagelocalpath = req.files.coverImage[0].path;
      }

    if (!avatarLocalpath) {
        throw new ApiErrors(400,"Avatar is required");
    }
    const avatar =await  uploadonCloudinary(avatarLocalpath);
    const coverImage =  await uploadonCloudinary(coverImagelocalpath);

    if (!avatar) {
        throw new ApiErrors(500 ,"Avatar upload failed ")   
    }

    const user = await User.create({   //  create user
        fullName,
        avatar : avatar.url ,
        coverImage : coverImage?.url || "",
        email,
        password,
        username :username.toLowerCase()
    })
   const createdUser =  await  User.findById(user._id).select("-password -refreshToken") // removing password and refresh token from response
   if (!createdUser) {
    throw new ApiErrors (500,"User creation failed")
   }

   return res.status(201).json(                          
    new ApiResponce(200,createdUser,"user created successfully")
   )
})
const loginUser=asyncHandler(async(req,res) =>{
    //req body -> data
    // userbname or email for login 
    // find the user 
    //password check 
    // access and refresh token  
    // send cookie 
    const {username,email,password} =req.body;
    if (!username && !email) {
        throw new ApiErrors (400,"required fields are missing ")
    }
    const user =  await User.findOne({      // find user by username or emailchecking if exists before `
        $or :[
            {username},{email}
        ]
    })
    if(!user){
        throw new ApiErrors(404,"user does not exist")
    }

    const ispasswordValid = await user.isPasswordCorrect(password) // password checking
    if(!ispasswordValid){
        throw new ApiErrors(401,"password invalid ")
    }
    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    const options ={
         httpOnly : true,  // client side js cannot access this cookie
         secure :true  // cookie will be sent only on https
    }
    return res
    .status(200)
    .cookie("refreshtoken",refreshToken,options)
    .cookie("accessToken",accessToken,options)
    .json(
        new ApiResponce(200,
            {
            user: loggedInUser,accessToken,refreshToken
            },"user logged in successfully"
        )
    )
})

const logoutUser =asyncHandler(async(req,res) =>{
     await User.findByIdAndUpdate(
        req.user._id,
          {
            $set:{
                refreshToken : undefined
            }
          },
          {
            new :true
          }
     )
    const options ={
         httpOnly : true,  
         secure :true ,  
    }
    return res
    .status(200)
    .clearCookie("refreshToken",options)
    .clearCookie("accessToken",options)
    .json(
        new ApiResponce(200,{},"user logged out succesfully ")
    )
})
const refreshAccessToken =asyncHandler(async(req,res) => {
    const incomingRefreshToken =req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiErrors(401,"unauthorized access")  
    }
   try {
     const decodedToken =jwt.verify(
         incomingRefreshToken,
         process.env.REFRESH_TOKEN_SECRET
     )
     const user=await User.findById(decodedToken?._id)
     if(!user){
         throw new ApiErrors(404,"invalid refresh token ")
     }
     if (incomingRefreshToken !== user.refreshToken) {
         throw new ApiErrors(401,"refresh token is expired or used  ")
     }
     const options ={
         httpOnly :true,
         secure :true
     }
     const {accessToken,newrefreshToken}=await generateAccessAndRefreshToken(user._id)
     return res
     .status(200)
     .cookie("accessToken",accessToken,options)
     .cookie("refreshToken",newrefreshToken,options)
     .json(
         new ApiResponce(200,
             {accessToken,refreshToken :newrefreshToken},
             "access token generated successfully "
         )
     )
   } catch (error) {
       throw new ApiErrors(401, error?.message ||"invalid refresh token")
   }

})

export {registerUser,
        loginUser,
        logoutUser,
        refreshAccessToken
}
