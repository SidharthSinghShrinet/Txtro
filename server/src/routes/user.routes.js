import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  getLoggedInUser,
  getAllUsers,
  getAllUsersWithMetadata,
  getAvatarPreSignedUrl,
  updateProfile,
  abortAvatarUpload,
  getProfileOptions,
} from "../controllers/user.controller.js";
import authenticate from "../middlewares/auth.middleware.js";
const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/logout", logoutUser);
router.get("/me", authenticate, getLoggedInUser);
router.get("/all", authenticate, getAllUsers);
router.get("/all/metadata", authenticate, getAllUsersWithMetadata);
router.post("/avatar-presigned-url", authenticate, getAvatarPreSignedUrl);
router.put("/profile", authenticate, updateProfile);
router.post("/avatar-abort", authenticate, abortAvatarUpload);
router.get("/profile-options", authenticate, getProfileOptions);

export default router;
