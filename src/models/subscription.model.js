import mongoose,{schema} from 'mongoose'

const subscriptionSchema =new mongoose.schema({
    subscriber :{
        type:schema.Types.objectId, //one who is subscribing
        ref :"User",
        required : true
    },
    channel :{
        type:schema.Types.objectId,
        ref:"User",  // one whom the subscriber is subscribing 
        required : true
    }
},{timestamps:true})


export const Subscription =mongoose.model("Subscription",subscriptionSchema)