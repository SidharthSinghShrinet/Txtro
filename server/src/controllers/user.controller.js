import { io } from "../socket/socket.js";
import userModel from "../models/user.model.js";
import expressAsyncHandler from "express-async-handler";
import ErrorHandler from "../utils/ErrorHandler.util.js";
import ApiResponse from "../utils/ApiResponse.util.js";
import generateToken from "../utils/jwt.util.js";
import conversationModel from "../models/conversation.model.js";
import messageModel from "../models/message.model.js";
import { deleteObjectsFromOCI, generatePreSignedUploadUrl } from "../utils/ociStorage.util.js";
import uploadIntentModel from "../models/uploadIntent.model.js";
import { MAX_BIO_LENGTH, USER_STATUS_OPTIONS, VALID_USER_STATUSES } from "../constants/userStatus.js";


//& @desc    Register a new user
//& @route   POST /api/v1/users/register
//& @access  Public

const registerUser = expressAsyncHandler(async (req, res) => {
  const { username, fullname, password } = req.body;
  if (!username || !fullname || !password) {
    throw new ErrorHandler(400, "Please provide all required fields");
  }
  const userExists = await userModel.findOne({ username });
  if (userExists) {
    throw new ErrorHandler(400, "User already exists. Please try with a different username");
  }
  const user = await userModel.create({
    username,
    fullname,
    password,
  });
  console.log("User created:", user);
  new ApiResponse(201, true, "User registered successfully", user).send(res);
});

//& @desc    Login a user
//& @route   POST /api/v1/users/login
//& @access  Public

const loginUser = expressAsyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    throw new ErrorHandler(400, "Please provide all required fields");
  }
  const existingUser = await userModel.findOne({ username });
  if (!existingUser) {
    throw new ErrorHandler(400, "Please register first");
  }
  const isMatch = await existingUser.comparePassword(password);
  if (!isMatch) {
    throw new ErrorHandler(400, "Invalid credentials");
  }
  // Here you would typically generate a JWT token
  const token = generateToken(existingUser);
  if (!token) {
    throw new ErrorHandler(500, "Token generation failed");
  }
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: parseInt(process.env.MAX_AGE || 24) * 60 * 60 * 1000, // Convert hours to milliseconds
  });
  const userResponse = existingUser.toObject ? existingUser.toObject() : { ...existingUser };
  delete userResponse.password;
  userResponse.token = token;

  new ApiResponse(200, true, "Login successfully", userResponse, { token }).send(
    res,
  );
});

//& @desc    Logout a user
//& @route   POST /api/v1/users/logout
//& @access  Private

const logoutUser = expressAsyncHandler(async (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
  new ApiResponse(200, true, "User Logout successfully").send(res);
});

//& @desc    Get Logged in user
//& @route   GET /api/v1/users/me
//& @access  Private
const getLoggedInUser = expressAsyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ErrorHandler(404, "User not found");
  }
  new ApiResponse(200, true, "User fetched successfully", user).send(res);
});

//& @desc    Get All Users (Excluding Logged In User)
//& @route   GET /api/v1/users/all
//& @access  Private
const getAllUsers = expressAsyncHandler(async (req, res) => {
  const userId = req?.user?._id;
  if (!userId) {
    throw new ErrorHandler(401, "Unauthorized, Please Login to get the user list");
  }
  const users = await userModel.find({ _id: { $ne: userId } }).select("-password");
  new ApiResponse(200, true, "Users list fetched successfully", users).send(res);
})

//& @desc   Get Paginated Users (Excluding Logged In User, But you will get metadata such as Last Message & Unread Count) -> Sidebar API
//& @route  GET /api/v1/users/all/metadata?page=1&limit=20
//& @access  Private
const getAllUsersWithMetadata = expressAsyncHandler(async (req, res, next) => {
  //^ 1. Get LoggedIn user id from authenticate middleware
  const loggedInUserId = req?.user?._id;
  if (!loggedInUserId) {
    throw new ErrorHandler(401, "Unauthorized, Please Login!");
  }
  //^ 2. Read Pagination from Query Params
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 20);
  const skip = (page - 1) * limit;

  //^ 3. PARALLEL EXECUTION: Fire all 4 queries simultaneously
  const [users, totalUsers, conversations, unreadAggregations] = await Promise.all([
    //! Q1. Fetch only 20 users for this page (.lean() strips mongoose bloat for speed)
    userModel
      .find({ _id: { $ne: loggedInUserId } })
      .select("username fullname isOnline lastSeen avatar avatarThumb bio customStatus")
      .skip(skip)
      .limit(limit)
      .lean(),

    //! Q2. Get total user count to compute totalPages
    userModel.countDocuments({ _id: { $ne: loggedInUserId } }),

    //! Q3. Get all active conversations of the logged-in user (excluding the group conversations)
    conversationModel
      .find({ participants: loggedInUserId })
      .populate({
        path: "lastMessage",
        select: "message senderId receiverId createdAt status messageType attachments"
      })
      .select("participants lastMessage updatedAt")
      .lean(),

    //! Q4. Count All unread messages grouped by conversation in a single pass
    messageModel.aggregate([
      {
        $match: {
          receiverId: loggedInUserId,
          status: { $ne: "read" }
        }
      },
      {
        $group: {
          _id: "$conversationId",
          unreadCount: { $sum: 1 }
        }
      }
    ])
  ]);
  //3. In-Memory O(1) Hash Map 
  // Instead of running slow nested loops, we map conversations by the other person's ID
  const conversationMap = new Map();
  for (const conv of conversations) {
    const otherParticipantId = conv.participants.find((id) => id.toString() !== loggedInUserId?.toString());
    if (otherParticipantId) {
      conversationMap.set(otherParticipantId.toString(), conv);
    }
  }

  // Map unread counts by conversationId for instant 0(1) Lookup
  const unreadCountMap = new Map(unreadAggregations.map((item) => [item._id.toString(), item.unreadCount]))

  //4. Merge Metadata into each user
  const userwithMetadata = users.map((user) => {
    const conv = conversationMap.get(user._id.toString());
    const unreadCount = conv ? (unreadCountMap.get(conv._id.toString()) || 0) : 0;
    return {
      ...user,
      lastMessage: conv?.lastMessage || null,
      unreadCount: unreadCount,
    }
  });

  userwithMetadata.sort((a, b) => {
    const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return timeB - timeA;
  })

  const totalPages = Math.ceil(totalUsers / limit);
  new ApiResponse(200, true, "Users list fetched successfully", userwithMetadata, {
    page,
    limit,
    totalPages,
    totalUsers,
    hasMore: page < totalPages
  }).send(res);
});


//& @desc    Generate pre-signed URL for direct-to-OCI avatar upload
//& @route   POST /api/v1/users/avatar-presigned-url
//& @access  Private
const getAvatarPreSignedUrl = expressAsyncHandler(async (req, res) => {
  const { originalFileName, mimeType } = req.body;
  if (!originalFileName || !mimeType) {
    throw new ErrorHandler(400, "OriginalFileName and MimeType is required")
  }

  // Security: Restrict strictly to images
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
  if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
    throw new ErrorHandler(400, "Only JPEG, PNG, and WebP images are allowed for avatars");
  }

  // 1. Generate both Full (512px) and Thumb (96px) OCI Pre-signed PUT URLs in parallel
  const [fullTicket, thumbTicket] = await Promise.all([
    generatePreSignedUploadUrl(`full-${originalFileName}`, mimeType),
    generatePreSignedUploadUrl(`thumb-${originalFileName}`, mimeType)
  ])

  // 2. Track BOTH keys in a single UploadIntent (pending) for the 3 AM Sweeper
  const intent = await uploadIntentModel.create({
    userId: req.user._id,
    keys: [fullTicket.objectKey, thumbTicket.objectKey],
    status: "pending"
  });

  new ApiResponse(200, true, "Avatar upload URLs generated successfully", {
    full: fullTicket,   // { presignedUrl, publicFileUrl, objectKey }
    thumb: thumbTicket,  // { presignedUrl, publicFileUrl, objectKey }
    uploadIntentId: intent._id
  }).send(res);
})

//& @desc    Update user profile (100% Atomic & Concurrency-Safe)
//& @route   PUT /api/v1/users/profile
//& @access  Private

const updateProfile = expressAsyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { fullname, bio, customStatus, avatar, avatarKey, avatarThumb, avatarThumbKey, removeAvatar, uploadIntentId } = req.body;

  // 1. Build an atomic $set dictionary (Partial updates prevent wiping sibling fields!)
  const updateFields = {};

  if (fullname !== undefined) {
    const trimmedFullname = fullname.trim();
    if (trimmedFullname.length < 3 || trimmedFullname.length > 100) {
      throw new ErrorHandler(400, "Full name must be between 3 and 100 characters");
    }
    updateFields.fullname = trimmedFullname;
  }

  if (bio !== undefined) {
    updateFields.bio = bio.slice(0, MAX_BIO_LENGTH).trim();
  }

  if (customStatus !== undefined) {
    if (!VALID_USER_STATUSES.includes(customStatus)) {
      throw new ErrorHandler(400, "Invalid custom status value");
    }
    updateFields.customStatus = customStatus;
  }
  if (removeAvatar) {
    updateFields.avatar = "";
    updateFields.avatarKey = "";
    updateFields.avatarThumb = ""
    updateFields.avatarThumbKey = ""
  } else if (avatar && avatarKey) {
    updateFields.avatar = avatar;
    updateFields.avatarKey = avatarKey;
    if (avatarThumb && avatarThumbKey) {
      updateFields.avatarThumb = avatarThumb;
      updateFields.avatarThumbKey = avatarThumbKey;
    }
  }

  // Guard Against Empty $set: {} in updateProfile
  if (Object.keys(updateFields).length === 0) {
    throw new ErrorHandler(400, "No valid profile fields provided to update")
  }

  // 2. ATOMIC CAS EXECUTION: findOneAndUpdate with returnDocument: "before"
  // This guarantees serialized document isolation at the MongoDB storage engine level.
  const previousUser = await userModel.findOneAndUpdate(
    { _id: userId },
    { $set: updateFields },
    {
      returnDocument: "before",   // Returns state BEFORE this atomic write
      runValidators: true,
      projection: "-password"
    }
  )

  if (!previousUser) {
    throw new ErrorHandler(404, "user not found");
  }

  // 3. Post-Commit OCI Garbage Collection for BOTH superseded keys
  const keysToPurge = [];
  if (previousUser.avatarKey && (removeAvatar || (updateFields.avatarKey && updateFields.avatarKey !== previousUser.avatarKey))) {
    keysToPurge.push(previousUser.avatarKey);
  }
  if (previousUser.avatarThumbKey && (removeAvatar || (updateFields.avatarThumbKey && updateFields.avatarThumbKey !== previousUser.avatarThumbKey))) {
    keysToPurge.push(previousUser.avatarThumbKey);
  }
  if (keysToPurge.length > 0) {
    deleteObjectsFromOCI(keysToPurge).catch((err) => {
      console.error(`⚠️ [OCI GC] Failed to purge superseded avatar keys:`, err);
    });
  }

  // 4. Mark the incoming UploadIntent as completed
  if (uploadIntentId && updateFields.avatarKey) {
    await uploadIntentModel.findByIdAndUpdate(uploadIntentId,
      { status: "completed" }
    )
  }

  // 5. Build the guaranteed latest state for client response and socket broadcast
  const updatedUser = {
    _id: previousUser._id,
    username: previousUser.username,
    fullname: updateFields.fullname !== undefined ? updateFields.fullname : previousUser.fullname,
    bio: updateFields.bio !== undefined ? updateFields.bio : previousUser.bio,
    customStatus: updateFields.customStatus !== undefined ? updateFields.customStatus : previousUser.customStatus,
    avatar: updateFields.avatar !== undefined ? updateFields.avatar : previousUser.avatar,
    avatarKey: updateFields.avatarKey !== undefined ? updateFields.avatarKey : previousUser.avatarKey,
    avatarThumb: updateFields.avatarThumb !== undefined ? updateFields.avatarThumb : previousUser.avatarThumb,
    avatarThumbKey: updateFields.avatarThumbKey !== undefined ? updateFields.avatarThumbKey : previousUser.avatarThumbKey,
    isOnline: previousUser.isOnline,
    lastSeen: previousUser.lastSeen,
  };

  // 6. Broadcast updated state across all connected sockets (Phone, Laptop, and Contacts)
  if (io) {
    io.emit("user:profile_updated", updatedUser);
  }

  new ApiResponse(200, true, "Profile Updated Successfully", updatedUser).send(res);
})

//& @desc    Immediately abort and delete an uncommitted avatar upload
//& @route   POST /api/v1/users/avatar-abort
//& @access  Private
const abortAvatarUpload = expressAsyncHandler(async (req, res) => {
  const { uploadIntentId, objectKey } = req.body;
  const userId = req.user._id;

  if (!uploadIntentId && !objectKey) {
    throw new ErrorHandler(400, "UploadIntentId or ObjectKey is required");
  }

  let keysToDelete = [];
  let intent = null;
  if (uploadIntentId) {
    intent = await uploadIntentModel.findOne(
      {
        _id: uploadIntentId,
        userId,
        status: "pending"
      }
    );

    if (intent && intent.keys?.length > 0) {
      keysToDelete = intent.keys;
    }
  } else if (objectKey) {
    // Fallback if only objectKey was sent: verify ownership via pending intent
    intent = await uploadIntentModel.findOne(
      {
        keys: objectKey,
        userId,
        status: "pending"
      }
    )
    if (intent) {
      keysToDelete = [objectKey];
    }
  }

  // 1. FIRST: Physically purge the uncommitted file from OCI
  if (keysToDelete.length > 0) {
    await deleteObjectsFromOCI(keysToDelete);
  }

  // 2. SECOND: Atomically mark intent as aborted only if it is still pending
  if (intent) {
    await uploadIntentModel.findOneAndUpdate(
      {
        _id: intent._id,
        status: "pending"
      },
      {
        $set: { status: "aborted" }
      }
    )
  }

  new ApiResponse(200, true, "Avatar upload aborted and cleaned up successfully").send(res);
});

//& @desc    Get profile customization options (valid statuses, bio limits)
//& @route   GET /api/v1/users/profile-options
//& @access  Private
const getProfileOptions = expressAsyncHandler(async (req, res) => {
  new ApiResponse(200, true, "Profile options fetched successfully", {
    statusOptions: USER_STATUS_OPTIONS,
    maxBioLength: MAX_BIO_LENGTH,
  }).send(res);
});

export { registerUser, loginUser, logoutUser, getLoggedInUser, getAllUsers, getAllUsersWithMetadata, getAvatarPreSignedUrl, updateProfile, abortAvatarUpload, getProfileOptions };
