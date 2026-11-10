import userModel from "../models/user.model.js";
import expressAsyncHandler from "express-async-handler";
import ErrorHandler from "../utils/ErrorHandler.util.js";
import ApiResponse from "../utils/ApiResponse.util.js";
import generateToken from "../utils/jwt.util.js";
import conversationModel from "../models/conversation.model.js";
import messageModel from "../models/message.model.js";

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
      .select("username fullname isOnline lastSeen")
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


export { registerUser, loginUser, logoutUser, getLoggedInUser, getAllUsers, getAllUsersWithMetadata };
