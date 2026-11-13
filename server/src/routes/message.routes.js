import Router from "express";
import { abortUpload, getMessage, getUploadUrl, sendMessage, toggleReaction, deleteForMe, deleteForEveryone, editMessage, getLinkPreview } from "../controllers/message.controller.js";
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

//& @desc    Delete message for me
//& @route   DELETE /api/v1/messages/delete-for-me/:id
//& @access  Private
router.delete("/delete-for-me/:id", authenticate, deleteForMe);

//& @desc    Delete message for everyone
//& @route   DELETE /api/v1/messages/delete-for-everyone/:id
//& @access  Private
router.delete("/delete-for-everyone/:id", authenticate, deleteForEveryone);

//& @desc    Edit a message
//& @route   PATCH /api/v1/messages/edit/:id
//& @access  Private
//& id -> Receiver Id
router.patch("/edit/:id", authenticate, editMessage);

//& @desc    Send a message
//& @route   POST /api/v1/messages/send/:id
//& @access  Private
//& id -> Receiver Id
router.post("/send/:id", authenticate, sendMessage);

//& @desc    Get Link Preview
//& @route   GET /api/v1/messages/link-preview
//& @access  Private
router.get("/link-preview", authenticate, getLinkPreview);

//& @desc    Getting messages between two users
//& @route   GET /api/v1/messages/:id
//& @access  Private
//& id -> Receiver Id
router.get("/:id", authenticate, getMessage);

export default router;