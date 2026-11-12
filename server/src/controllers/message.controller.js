import expressAsyncHandler from "express-async-handler";
import messageModel from "../models/message.model.js";
import conversationModel from "../models/conversation.model.js";
import ErrorHandler from "../utils/ErrorHandler.util.js";
import ApiResponse from "../utils/ApiResponse.util.js";
import { getReceiverSocketIds, io } from "../socket/socket.js";
import { deleteObjectsFromOCI, generatePreSignedUploadUrl } from "../utils/ociStorage.util.js";
import { text } from "express";
import uploadIntentModel from "../models/uploadIntent.model.js";


const getUploadUrl = expressAsyncHandler(async (req, res) => {
    const { files = [] } = req.body;
    // Normalize: allow sending either { files: [...] } OR a single { fileName, fileType }
    const fileList = Array.isArray(files) && files.length > 0 ? files : ((req.body.fileName && req.body.fileType ? [{ fileName: req.body.fileName, fileType: req.body.fileType }] : []))
    if (fileList.length === 0) {
        throw new ErrorHandler(400, "At least one file (fileName & fileType) is required");
    };

    if (fileList.length > 10) {
        throw new ErrorHandler(400, "Maximum 10 files allowed per request");
    }

    // Validate Supported Formats (Images, PDFs, Word, Excel, PPT, Archives/ZIP, Text/CSV, Audio)
    const allowedTypes = /^(image\/(jpeg|jpg|png|webp|gif|svg\+xml)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|application\/vnd\.ms-excel|application\/vnd\.ms-powerpoint|application\/(zip|x-zip|x-zip-compressed|x-7z-compressed|x-tar|gzip|x-gzip|vnd\.rar|x-rar-compressed)|text\/(plain|csv)|audio\/(webm|mp3|ogg|wav|mpeg|m4a|aac|x-m4a))$/i;
    const allowedExtensions = /\.(jpg|jpeg|png|webp|gif|svg|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|7z|rar|tar|gz|txt|csv|webm|mp3|ogg|wav|m4a|aac)$/i;

    for (const f of fileList) {
        if (!f.fileName) {
            throw new ErrorHandler(400, "Each file must have fileName");
        }
        const isMimeAllowed = f.fileType && allowedTypes.test(f.fileType);
        const isExtensionAllowed = allowedExtensions.test(f.fileName);

        if (!isMimeAllowed && !isExtensionAllowed) {
            throw new ErrorHandler(400, `Unsupported file format: ${f.fileType || f.fileName}`);
        }
    }
    // Generate pre-signed URLs in parallel
    const uploadTickets = await Promise.all(
        fileList.map((f) => generatePreSignedUploadUrl(f.fileName, f.fileType))
    );

    console.log(uploadTickets)
    // Create the Upload Intent to track these keys
    const intent = await uploadIntentModel.create({
        userId: req.user._id,
        keys: uploadTickets.map((ticket) => ticket.objectKey),
        status: "pending"
    });

    const responseData = {
        uploadIntentId: intent._id,
        // If single file requested, return object for convenience; if array, return array
        tickets: Array.isArray(files) && files.length > 0 ? uploadTickets : uploadTickets[0]
    }

    new ApiResponse(200, true, "Pre-signed upload URL generated successfully", responseData
    ).send(res);
})

const abortUpload = expressAsyncHandler(async (req, res) => {
    const { uploadIntentId, keys = [] } = req.body;
    if (!uploadIntentId && (!keys || keys.length === 0)) {
        throw new ErrorHandler(400, "uploadIntentId or keys are required");
    }
    let keysToDelete = Array.isArray(keys) ? keys : [];
    let intent = null;
    if (uploadIntentId) {
        intent = await uploadIntentModel.findById(uploadIntentId);
        if (intent) {
            // Delete ALL keys authorized by this intent.
            // This guarantees any in-flight files (e.g. 6th image) are also deleted!
            keysToDelete = intent.keys
        }
    }
    // 1. FIRST: Physically purge the files from Oracle Cloud
    if (keysToDelete.length > 0) {
        await deleteObjectsFromOCI(keysToDelete)
    }

    // 2. SECOND: Update the database only after OCI deletion succeeds
    if (intent) {
        intent.status = "aborted";
        await intent.save();
    }

    new ApiResponse(200, true, "Upload aborted and files cleaned up successfully", null).send(res);
});

const sendMessage = expressAsyncHandler(async (req, res, next) => {
    const senderId = req.user._id;
    const receiverId = req.params.id;
    const { message = "", attachments = [], messageType = "text", uploadIntentId, replyTo } = req.body;
    const hasTextMessage = Boolean(message && message.trim());
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    if (!hasTextMessage && !hasAttachments) {
        throw new ErrorHandler(400, "Message Content or File Attachment is required");
    }
    const sortedParticipants = [senderId.toString(), receiverId.toString()].sort();
    const conversation = await conversationModel.findOneAndUpdate(
        { participants: sortedParticipants },
        { $setOnInsert: { participants: sortedParticipants } },
        { upsert: true, new: true }
    );

    const receiverSocketIds = getReceiverSocketIds(receiverId);
    const initialStatus = receiverSocketIds.length > 0 ? "delivered" : "sent";

    let finalMessageType = "text";
    if (hasAttachments) {
        const hasImages = attachments.some((a) => a.mimeType?.startsWith("image/"));
        const hasAudio = attachments.some((a) => a.mimeType?.startsWith("audio/"));
        const hasDocs = attachments.some((a) => !a.mimeType?.startsWith("image/") && !a.mimeType?.startsWith("audio"));

        // If batch contains both images AND documents -> "mixed"
        if (hasImages && hasDocs) {
            finalMessageType = "mixed";
        } else if (hasAudio) {
            finalMessageType = "audio";
        } else if (hasImages) {
            finalMessageType = 'image';
        } else {
            finalMessageType = "document";
        }
    }

    // Build immutable reply snapshot if replying to an existing message (Phase 11)
    let replySnapshot = null;
    if (replyTo) {
        const originalMsg = await messageModel.findById(replyTo).populate("senderId", "fullname username");
        if (originalMsg) {
            replySnapshot = {
                senderId: originalMsg.senderId?._id || originalMsg.senderId,
                senderName: originalMsg.senderId?.fullname || originalMsg.senderId?.username || "User",
                message: originalMsg.message || "",
                messageType: originalMsg.messageType || "text",
                fileUrl: originalMsg.attachments?.[0]?.fileUrl || null,
                fileName: originalMsg.attachments?.[0]?.fileName || null
            }
        }
    }
    const newMessage = await messageModel.create({
        senderId,
        receiverId,
        conversationId: conversation._id,
        message: message ? message.trim() : "",
        status: initialStatus,
        messageType: finalMessageType,
        attachments: attachments,
        replyTo: replyTo || null,  // <--- // Pointer for jump-to-message
        replySnapshot: replySnapshot
    })
    // If an uploadIntentId was sent, mark it as completed (or delete it)
    if (uploadIntentId) {
        await uploadIntentModel.findByIdAndUpdate(uploadIntentId, { status: "completed" })
    }
    if (!newMessage) {
        throw new ErrorHandler(400, "Failed to send message");
    }
    await conversationModel.findByIdAndUpdate(conversation._id, {
        lastMessage: newMessage._id
    })

    receiverSocketIds.forEach((socketId) => {
        io.to(socketId).emit("newMessage", newMessage);
    })
    new ApiResponse(201, true, "Message sent successfully", newMessage).send(res);
})

const getMessage = expressAsyncHandler(async (req, res, next) => {
    const senderId = req?.user?._id;
    const receiverId = req?.params?.id;
    const sortedParticipants = [senderId.toString(), receiverId.toString()].sort();
    const conversation = await conversationModel.findOne({
        participants: sortedParticipants
    });
    if (!conversation) {
        return new ApiResponse(200, true, "No conversation found", []).send(res);
    }
    const messages = await messageModel.find({ conversationId: conversation._id, deletedFor: { $ne: senderId } }).sort({ createdAt: 1 });

    // 1. Mark unread messages sent to me as 'read'
    await messageModel.updateMany({ conversationId: conversation._id, receiverId: senderId, status: { $ne: "read" } }, { status: "read" });

    // 2. Notify the other user (receiver) in real time that their messages were seen
    const otherUserSockets = getReceiverSocketIds(receiverId);
    otherUserSockets.forEach((sId) => {
        io.to(sId).emit("messageSeen", {
            conversationId: conversation._id,
            seenBy: senderId.toString()
        })
    })
    new ApiResponse(200, true, "Message fetched successfully", messages).send(res)
})

/*
& This controller will handle three scenarios:-
^ Scenario 1: Adding a Brand New Reaction on any message 
^ Scenario 2: Removing / Undoing a Reaction (Toggle Off)
^ Scenario 3: Changing Reactions (e.g. 👍 to 😂)
*/
const toggleReaction = expressAsyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;
    if (!emoji || typeof emoji !== "string") {
        throw new ErrorHandler(400, "Valid Emoji String is required");
    }
    // 1. Check if message exists and find if THIS user already reacted
    const message = await messageModel.findById(messageId).select("senderId receiverId reactions conversationId");
    if (!message) {
        throw new ErrorHandler(404, "Message not found");
    }
    const existingReaction = message.reactions.find((r) => r.userId.toString() === userId.toString());
    let updatedMessage;
    if (existingReaction) {
        if (existingReaction.emoji === emoji) {
            // SCENARIO 2: Clicked same emoji -> ATOMIC REMOVE ($pull)
            updatedMessage = await messageModel.findByIdAndUpdate(messageId,
                { $pull: { reactions: { userId: userId } } },
                { new: true }
            )
        } else {
            // SCENARIO 3: Clicked different emoji -> ATOMIC UPDATE ($set)
            updatedMessage = await messageModel.findOneAndUpdate(
                { _id: messageId, "reactions.userId": userId },
                {
                    $set: { "reactions.$.emoji": emoji }
                },
                {
                    new: true
                }
            )
        }
    } else {
        // SCENARIO 1: First time reacting -> ATOMIC ADD ($push)
        updatedMessage = await messageModel.findByIdAndUpdate(
            messageId,
            { $push: { reactions: { userId: userId, emoji: emoji } } },
            { new: true }
        )
    }

    // 2. Identify the other participant
    const otherUserId = updatedMessage.senderId.toString() === userId.toString()
        ? updatedMessage.receiverId
        : updatedMessage.senderId;


    // 3. Broadcast real-time reaction update to both users (and all their open devices/tabs)
    const allRecipientSockets = [
        ...getReceiverSocketIds(otherUserId),
        ...getReceiverSocketIds(userId)
    ];

    allRecipientSockets.forEach((sId) => {
        io.to(sId).emit("messageReactionUpdated", {
            messageId: updatedMessage._id,
            conversationId: updatedMessage.conversationId,
            reactions: updatedMessage.reactions
        })
    });
    new ApiResponse(200, true, "Reaction Updated Successfully", {
        messageId: updatedMessage._id,
        reactions: updatedMessage.reactions
    }).send(res);
});

//! Message Deletion Controller (Phase/Features 12)
// & Controller 1: Delete For Me
const deleteForMe = expressAsyncHandler(async (req, res) => {
    const { id: messageId } = req.params;
    const userId = req.user._id;
    // Atomic update: $addToSet guarantees no duplicates and zero race conditions
    const updatedMessage = await messageModel.findByIdAndUpdate(messageId, {
        $addToSet: { deletedFor: userId }
    },
        { new: true }
    );
    if (!updatedMessage) {
        throw new ErrorHandler(404, "Message not found");
    }
    new ApiResponse(200, true, "Message deleted for you", {
        messageId,
        deletedType: "me"
    }).send(res);
});

const deleteForEveryone = expressAsyncHandler(async (req, res) => {
    const { id: messageId } = req.params;
    const userId = req.user._id;

    // 1. Fetch message to validate sender & time-window
    const existingMessage = await messageModel.findById(messageId);
    if (!existingMessage) {
        throw new ErrorHandler(404, "Message not found");
    };
    // Authorization: Only sender can delete for everyone
    if (existingMessage.senderId.toString() !== userId.toString()) {
        throw new ErrorHandler(403, "You can only delete your own messages for everyone");
    }
    // Time window: 48 hours
    const messageAgeHours = (Date.now() - new Date(existingMessage.createdAt).getTime()) / (1000 * 60 * 60);
    if (messageAgeHours > 48) {
        throw new ErrorHandler(400, "Messages older than 48 hours cannot be deleted for everyone")
    }
    // Guard: If already deleted, return early
    if (existingMessage.isDeletedForEveryone) {
        return new ApiResponse(200, true, "Message already deleted", { messageId }).send(res);
    }

    // 2. OCI FIRST: Physically delete attachments from Oracle Cloud
    if (Array.isArray(existingMessage.attachments) && existingMessage.attachments.length > 0) {
        const keysToDelete = existingMessage.attachments.map((att) => {
            if (!att.fileUrl) return null;
            const parts = att.fileUrl.split("/o/");
            return parts[1] ? decodeURIComponent(parts[1]) : null;
        }).filter(Boolean);

        if (keysToDelete.length > 0) {
            // If OCI fails, this throws ErrorHandler and DB is NOT touched!
            await deleteObjectsFromOCI(keysToDelete);
        }
    }

    // 3. DATABASE SECOND: Atomic CAS (Compare-And-Swap)
    // Guarantees only one concurrent request can flip isDeletedForEveryone to true
    const tombstonedMessage = await messageModel.findOneAndUpdate(
        {
            _id: messageId,
            senderId: userId,
            isDeletedForEveryone: false // 👈 Atomic lock!
        },
        {
            $set: {
                isDeletedForEveryone: true,
                message: "", // Wipe sensitive text
                attachments: [] // Wipe attachments from DB
            }
        },
        { new: true }
    )
    if (!tombstonedMessage) {
        return new ApiResponse(200, true, "Message already deleted", { messageId }).send(res);
    }

    // 4. Real-time broadcast to the receiver via Socket.IO
    const receiverId = tombstonedMessage.receiverId.toString() === userId.toString()
        ? tombstonedMessage.senderId
        : tombstonedMessage.receiverId;
    const receiverSocketIds = getReceiverSocketIds(receiverId);
    receiverSocketIds.forEach((sId) => {
        io.to(sId).emit("messageDeleted", {
            messageId: tombstonedMessage._id,
            conversationId: tombstonedMessage.conversationId,
            deleteType: "everyone"
        });
    });
    new ApiResponse(200, true, "Message deleted for everyone", {
        messageId: tombstonedMessage._id,
        conversationId: tombstonedMessage.conversationId,
        deleteType: "everyone"
    }).send(res);
});

export { sendMessage, getMessage, getUploadUrl, abortUpload, toggleReaction, deleteForMe, deleteForEveryone };