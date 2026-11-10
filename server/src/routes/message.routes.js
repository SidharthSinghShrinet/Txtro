import Router from "express";
import { abortUpload, getMessage, getUploadUrl, sendMessage, toggleReaction } from "../controllers/message.controller.js";
import authenticate from "../middlewares/auth.middleware.js";
const router = Router();

//& @desc    Getting direct upload ticket (Browser Upload -> OCI Storage)
//& @route   POST /api/v1/messages/upload-url
//& @access  Private
router.post("/upload-url", authenticate, getUploadUrl);

//& @desc    Abort an upload and clean up completed files
//& @route   POST /api/v1/messages/abort-upload
//& @access  Private
router.post("/abort-upload", authenticate, abortUpload);

//& @desc    Toggle reaction on a message
//& @route   POST /api/v1/messages/react/:messageId
//& @access  Private
router.post("/react/:messageId", authenticate, toggleReaction);

//& @desc    Send a message
//& @route   POST /api/v1/messages/send/:id
//& @access  Private
//& id -> Receiver Id
router.post("/send/:id", authenticate, sendMessage);

//& @desc    Getting messages between two users
//& @route   GET /api/v1/messages/:id
//& @access  Private
//& id -> Receiver Id
router.get("/:id", authenticate, getMessage);

export default router;