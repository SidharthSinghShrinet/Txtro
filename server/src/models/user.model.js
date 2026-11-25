import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userModel = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
      maxlength: 25,
      trim: true,
      lowercase: true,
    },
    fullname: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 100,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    avatar: {
      type: String,
      default: "",   // Public OCI URL (512px)
    },
    avatarKey: {
      type: String,
      default: ""  // OCI unique key (512px)
    },
    avatarThumb: {
      type: String,
      default: ""    // Public OCI URL (96px sidebar thumbnail)
    },
    avatarThumbKey: {
      type: String,
      default: ""   // OCI unique key (96px)
    },
    bio: {
      type: String,
      maxlength: 120,
      default: "Hey there! I am using Txtro.",
      trim: true
    },
    customStatus: {
      type: String,
      enum: ["available", "busy", "away", "offline"],
      default: "available"
    }
  },
  {
    timestamps: true,
  },
);

userModel.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userModel.methods.comparePassword = async function (enteredPassword) {
  let result = await bcrypt.compare(enteredPassword, this.password);
  return result;
};

export default mongoose.model("User", userModel);
