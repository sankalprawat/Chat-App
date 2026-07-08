const mongoose = require("mongoose");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const signUp = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        message: "required fields not filled",
      });
    }

    const user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({
        message: "User already exists, Please Login!",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      fullName,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "User created successfully",
      data: newUser,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      message: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }
    const user = await User.findOne({ email });
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

    const payload = {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "365d",
    });

    res.status(200).json({
      message: "Login successful",
      data: { user, token },
    });
    // console.log("User: ", user);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { email, fullName, profilePic, googleId } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        fullName,
        profilePic,
        googleId,
      });
    } else {
      user.fullName = fullName;
      user.profilePic = profilePic;
      user.googleId = googleId;
      await user.save();
    }
    const payload = {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "365d",
    });

    res.status(200).json({
      message: "login successfully",
      data: { user, token },
    });
  } catch (error) {
    console.log("google login error", error);
    res.status(500).json({ message: "server error" });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const getUser = await User.findById(userId).select("-password");

    res.status(200).json({
      message: "This is profile page",
      user: getUser,
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

    if (req.body.email) {
      const existingEmail = await User.findOne({ email: req.body.email, _id: { $ne: userId } });
      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }
      updateData.email = req.body.email;
    }

    if (req.body.fullName) {
      updateData.fullName = req.body.fullName;
    }

    if (req.imageUrl) {
      updateData.profilePic = req.imageUrl[0];
    }
    const updateUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });

    res.status(200).json({
      message: "Profile update successfully",
      data: updateUser,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
};

const getAllContacts = async (req, res) => {
  try {
    const loginUserId = new mongoose.Types.ObjectId(req.user._id);

    // 1. Get all recent messages for this user efficiently
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

    const lastMessageMap = {};
    recentMessages.forEach((msg) => {
      lastMessageMap[msg._id.toString()] = msg.lastMessageTime;
    });

    // 2. Get all users
    let users = await User.find({ _id: { $ne: loginUserId } })
      .select("-password")
      .lean();

    // 3. Map and sort in memory
    users = users.map((user) => {
      return {
        ...user,
        lastMessageTime: lastMessageMap[user._id.toString()] || new Date(0),
      };
    });

    users.sort((a, b) => {
      // Sort by last message time (descending)
      if (b.lastMessageTime > a.lastMessageTime) return 1;
      if (b.lastMessageTime < a.lastMessageTime) return -1;
      // Then sort by name (ascending)
      return a.fullName.localeCompare(b.fullName);
    });

    // 4. Remove lastMessageTime to match previous projection
    users = users.map((user) => {
      const { lastMessageTime, ...rest } = user;
      return rest;
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

const imageUpload = async (req, res) => {
  try {
    res.status(200).json({
      message: "Image Upload",
      file: req.file,
      image: req.imageUrl,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  signUp,
  login,
  getProfile,
  updateProfile,
  getAllContacts,
  imageUpload,
  googleLogin
};
