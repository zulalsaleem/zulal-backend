import mongoose ,{model, Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
import { Video } from "./video.model";

const commentSchema =new model.Schema(
    {
        content:{
            type:String,
            required: true
        },
        video:{
            type:Schema.Types.ObjectId,
            ref:"Video"
        },
        owner:{
            type:Schema.Types.ObjectId,
            ref:"User"
        }
    },{
        timestamps:true
    }
)

commentSchema.Schema.plugin(mongooseAggregatePaginate)


export const Comment = mongoose.model("comment", commentSchema)