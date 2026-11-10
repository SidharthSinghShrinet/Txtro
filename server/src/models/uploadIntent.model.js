import mongoose, { mongo } from "mongoose";

const uploadIntentModel = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        keys: [
            {
                type: String,
                required: true
            }
        ],
        status: {
            type: String,
            enum: ["pending", "completed", "aborted"],
            default: "pending",
            index: true
        },
        createdAt: {
            type: Date,
            default: Date.now,
            // MongoDB TTL: automatically purges the metadata row after 7 days
            // so your MongoDB collection stays tiny forever.
            expires: "7d"
        }
    },
    { timestamps: true });

// Compound index so the sweeper cron query runs in ~1ms
uploadIntentModel.index({ status: 1, createdAt: 1 });

export default mongoose.model("UploadIntent", uploadIntentModel);