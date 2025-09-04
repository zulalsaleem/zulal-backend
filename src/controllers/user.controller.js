import { asyncHandler }from "../utils/asyncHandler.js";
import {ApiErrors} from "../utils/ApiErrors.js";
import {user} from "../models/user.model.js";
import {uploadonCloudinary} from "../utils/cloudinary.js";
import { ApiResponce } from "../utils/ApiRespnce.js";


const registerUser=asyncHandler(async(req,res) =>{
    // get user details from front end 
    // validation  - not empty
    // check if user is already exists : username ,email
    // check for images ,check for avatar 
    // upload them cloudinary, avatar
    // crate user objects  - create entry in db 
    // remove password and refresh token filed from response  
    // check for user creation 
    // return response

    const {username,fullName,email,password} =req.body  // destructuring user details from req body
    console.log("email :",email);
    
    if (
        [username, email, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiErrors(400, "Required fields are missing");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)){
        throw new ApiErrors(400,"Invalid email format");
    }

    const existedUser =user.findOne({       //validation for existing user
        $or : [{username},{email}]
    })
    if (existedUser) {
        throw new ApiErrors(409,"User already exists")
    }
    // handle file upload
    // upload to cloudinary 
    // get the url of uploaded image
    const avatarLocalpath = req.files?.avatar[0]?.path;
    const coverImagelocalpath  = req.files?.coverImage[0]?.path;

    if (!avatarLocalpath) {
        throw new ApiErrors(400,"Avatar is required");
    }
    const avatar =await  uploadonCloudinary(avatarLocalpath);
    const coverImage =  await uploadonCloudinary(coverImagelocalpath);

    if (!avatar) {
        throw new ApiErrors(500 ,"Avatar upload failed ")   
    }

    const user = await user.create({   //  create user
        fullName,
        avatar : avatar.url,
        coverImage : coverImage.url || "",
        email,
        password,
        username :username.toLowerCase()
    })
   const createdUser =  await  user.findById(user._id).select("-password -refreshToken") // removing password and refresh token from response
   if (!createdUser) {
    throw new ApiErrors (500,"User creation failed")
   }

   return res.status(201).json(                          
    new ApiResponce(200,createdUser,"user created successfully")
   )
})


export {registerUser}