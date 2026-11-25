const mongoose = require("mongoose");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { verifyFirebaseIdToken } = require("../services/firebaseAuth");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signAuthToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "365d" }
  );

const signUp = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (
      typeof fullName !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({ message: "Invalid input types" });
    }

    const trimmedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName || !normalizedEmail || !password) {
      return res.status(400).json({
        message: "Required fields not filled",
      });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists, Please Login!",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      fullName: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "User created successfully",
      data: newUser.toJSON(),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "User already exists, Please Login!" });
    }
    console.log(error.message);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    if (!user.password) {
      return res.status(400).json({ message: "Please login with Google" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Password or username incorrect",
      });
    }

    const token = signAuthToken(user);

    res.status(200).json({
      message: "Login successful",
      data: { user: user.toJSON(), token },
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    const verified = await verifyFirebaseIdToken(idToken);

    let user = await User.findOne({ email: verified.email });
    if (!user) {
      user = await User.create({
        email: verified.email,
        fullName: verified.fullName || verified.email.split("@")[0],
        profilePic: verified.profilePic || "",
        googleId: verified.googleId,
      });
    } else {
      if (user.googleId && user.googleId !== verified.googleId) {
        return res.status(403).json({ message: "Google account mismatch" });
      }
      let dirty = false;
      if (!user.googleId) {
        user.googleId = verified.googleId;
        dirty = true;
      }
      if (!user.fullName && verified.fullName) {
        user.fullName = verified.fullName;
        dirty = true;
      }
      if (!user.profilePic && verified.profilePic) {
        user.profilePic = verified.profilePic;
        dirty = true;
      }
      if (dirty) {
        await user.save();
      }
    }

    const token = signAuthToken(user);

    res.status(200).json({
      message: "Login successful",
      data: { user: user.toJSON(), token },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.log("google login error", error);
    res.status(500).json({ message: "server error" });
  }
};

const getProfile = async (req, res) => {
  try {
    res.status(200).json({
      message: "This is profile page",
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = {};

    if (req.body.email !== undefined) {
      if (typeof req.body.email !== "string") {
        return res.status(400).json({ message: "Invalid email" });
      }
      const normalizedEmail = req.body.email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({ message: "Please enter a valid email address" });
      }
      const existingEmail = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: userId },
      }).lean();
      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }
      updateData.email = normalizedEmail;
    }

    if (req.body.fullName !== undefined) {
      if (typeof req.body.fullName !== "string" || !req.body.fullName.trim()) {
        return res.status(400).json({ message: "Full name cannot be empty" });
      }
      updateData.fullName = req.body.fullName.trim();
    }

    if (Array.isArray(req.imageUrl) && req.imageUrl.length > 0) {
      updateData.profilePic = req.imageUrl[0];
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No valid fields provided to update" });
    }

    const updateUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updateUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      data: updateUser.toJSON(),
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
};

const getAllContacts = async (req, res) => {
  try {
    const loginUserId = new mongoose.Types.ObjectId(req.user._id);

    // 1. Get all recent messages for this user efficiently using separate indexed branches
    const recentMessages = await mongoose.model("Message").aggregate([
      {
        $match: {
          $or: [{ senderId: loginUserId }, { receiverId: loginUserId }],
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", loginUserId] },
              "$receiverId",
              "$senderId",
            ],
          },
          lastMessageTime: { $max: "$createdAt" },
        },
      },
    ]);

    const lastMessageMap = new Map();
    recentMessages.forEach((msg) => {
      if (msg._id) {
        lastMessageMap.set(msg._id.toString(), msg.lastMessageTime);
      }
    });

    // 2. Get all other users
    const users = await User.find({ _id: { $ne: loginUserId } })
      .select("-password")
      .lean();

    // 3. Sort in memory by lastMessageTime descending, then fullName ascending
    users.sort((a, b) => {
      const timeA = lastMessageMap.get(a._id.toString())?.getTime() || 0;
      const timeB = lastMessageMap.get(b._id.toString())?.getTime() || 0;
      if (timeB !== timeA) return timeB - timeA;
      return (a.fullName || "").localeCompare(b.fullName || "");
    });

    res.status(200).json({
      message: "Fetched all contacts",
      user: users,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  signUp,
  login,
  getProfile,
  updateProfile,
  getAllContacts,
  googleLogin,
};
