import cron from "node-cron";
import uploadIntentModel from "../models/uploadIntent.model.js";
import { deleteObjectsFromOCI } from "./ociStorage.util.js";


export const initSweeperJob = async () => {
    // Runs once every day at 3:00 AM server time
    cron.schedule("0 3 * * *", async () => {
        try {
            console.log("🧹 [Sweeper] Starting scheduled abandoned upload cleanup...");
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            // Find all intents stuck in 'pending' for over 24 hours
            const abandonedIntents = await uploadIntentModel.find({
                status: "pending",
                createdAt: { $lt: twentyFourHoursAgo }
            })
            if (abandonedIntents.length === 0) {
                console.log("🧹 [Sweeper] No abandoned uploads found.");
                return;
            }
            let totalDeletedFiles = 0;
            for (const intent of abandonedIntents) {
                if (intent.keys && intent.keys.length > 0) {
                    await deleteObjectsFromOCI(intent.keys);
                    totalDeletedFiles += intent.keys.length;
                }
                intent.status = "aborted";
                await intent.save();
            }
            console.log(`🧹 [Sweeper] Successfully cleaned ${totalDeletedFiles} files across ${abandonedIntents.length} abandoned intents.`);
        } catch (error) {
            console.error("❌ [Sweeper] Error during cleanup job:", error);
        }
    })
    console.log("⏰ Sweeper cron job registered (Runs daily at 3:00 AM).");
}