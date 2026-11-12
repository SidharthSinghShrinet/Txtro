import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
        index: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    message: {
        type: String,
        trim: true,
        default: ""
    },
    status: {
        type: String,
        enum: ["sent", "delivered", "read"],
        default: "sent"
    },
    //& Rollout 2 (Phase 8 - Multimedia Support)
    messageType: {
        type: String,
        enum: ["text", "image", "document", "audio", "mixed"],
        default: "text"
    },
    attachments: [
        {
            fileUrl: {
                type: String,
                required: true
            },
            fileName: {
                type: String,
                default: null
            },
            fileSize: {
                type: Number,
                default: null
            },
            mimeType: {
                type: String,
                default: null
            },
            duration: {
                type: Number,  // Duration in seconds (e.g. 14 for 0:14)
                default: 0
            },
            waveform: [
                {
                    type: Number  // Exact speech amplitude peaks (0 - 100)
                }
            ]
        }
    ],
    reactions: [
        {
            _id: false,  // 👈 Tells Mongoose NOT to generate an automatic _id for reactions
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true
            },
            emoji: {
                type: String,
                required: true
            }
        }
    ],
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null
    },
    replySnapshot: {
        _id: false, // 👈 Prevents Mongoose from generating an unwanted subdocument ID
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        senderName: {
            type: String,
            default: ""
        },
        message: {
            type: String,
            default: ""
        },
        messageType: {
            type: String,
            enum: ["text", "image", "document", "audio", "mixed"],
            default: "text"
        },
        fileUrl: {
            type: String,
            default: null
        },
        fileName: {
            type: String,
            default: null
        }
    },
    deletedFor: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    isDeletedForEveryone: {
        type: Boolean,
        default: false
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

messageSchema.index({ conversationId: 1, createdAt: -1 })

export default mongoose.model("Message", messageSchema);