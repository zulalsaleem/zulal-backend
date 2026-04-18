import {ApiErrors as ApiError} from "../utils/ApiErrors.js"
import {ApiResponce as ApiResponse} from "../utils/ApiRespnce.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const healthcheck = asyncHandler(async (req, res) => {
    return res.status(200).json(
        new ApiResponse(200, {
            status: "OK",
            message: "Service is healthy and running",
            timestamp: new Date().toISOString()
        }, "Health check successful")
    )
})

export {
    healthcheck
}