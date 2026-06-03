const { data } = require("react-router-dom");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const signUp = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        message: "required fields not filled",
      });
    }

    const user = await User.findOne({ email });
    console.log(user);

    if (user) {
      return res.status(400).json({
        message: "User already exists, Please Login!",
      });
    }
    const newUser = await User.create({
      fullName,
      email,
      password,
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
    if (user.password !== password) {
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
      expiresIn: "1d",
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
    const updateUser = await User.findByIdAndUpdate(userId, req.body, {
      new: true,
    });

    res.status(200).json({
      message: "Profile update successfully",
      data: updateUser,
    });
  } catch (error) {}
};

const getAllContacts = async (req, res) => {
  try {
    const loginUserId = req.user._id;
    const query = { _id: { $ne: loginUserId } };
    const user = await User.find(query);

    res.status(200).json({
      message: "All Users",
      user: user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const imageUpload = async (req, res) => {
  try {
    console.log(req.file)
    res.status(200).json({
      message: "Image Upload",
      file:req.file
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { signUp, login, getProfile, updateProfile, getAllContacts, imageUpload };
