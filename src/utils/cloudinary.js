
import {v2 as cloudinary} from 'cloudinary'
import fs from "fs"



cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadonCloudinary = async (localfilepath) => {
    try {
        if (!localfilepath) return null
        const response = await cloudinary.uploader.upload(localfilepath, {
            resource_type: "auto"
        })
        fs.unlinkSync(localfilepath)
        return response;
    } catch (error) {
        if (fs.existsSync(localfilepath)) fs.unlinkSync(localfilepath)
        return null;
    }
}

const deleteFromCloudinary = async (url) => {
    try {
        if (!url) return null;
        const urlParts = url.split("/");
        const uploadIndex = urlParts.indexOf("upload");
        const resourceType = urlParts[uploadIndex - 1];
        const publicIdWithExt = urlParts.slice(uploadIndex + 2).join("/");
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, "");
        return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (error) {
        console.error("Error deleting from Cloudinary:", error);
        return null;
    }
}

export { uploadonCloudinary, deleteFromCloudinary }

