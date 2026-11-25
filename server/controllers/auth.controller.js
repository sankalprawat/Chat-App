const mongoose = require("mongoose");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const {
  getJwtKey,
  invalidateUserCache,
  getCachedDirectoryTop,
  getCachedContactsPage,
  setCachedContactsPage,
  invalidateDirectoryCache,
} = require("../services/authCache");
const { hashPassword, comparePassword } = require("../services/passwordHasher");
const { verifyFirebaseIdToken } = require("../services/firebaseAuth");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signAuthToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
    },
    getJwtKey(),
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

    const hashedPassword = await hashPassword(password, 10);
    const newUser = await User.create({
      fullName: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
    });
    invalidateDirectoryCache();

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

    const isMatch = await comparePassword(password, user.password);
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

    invalidateUserCache(userId);

    res.status(200).json({
      message: "Profile updated successfully",
      data: updateUser.toJSON(),
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
};

const compareContactNames = (a, b) => {
  const nameA = (a.fullName || "").toLowerCase();
  const nameB = (b.fullName || "").toLowerCase();
  if (nameA < nameB) return -1;
  if (nameA > nameB) return 1;
  return 0;
};

const getAllContacts = async (req, res) => {
  try {
    const loginUserId = new mongoose.Types.ObjectId(req.user._id);
    const loginUserStr = loginUserId.toString();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const cached = getCachedContactsPage(loginUserStr, page, limit);
    if (cached) {
      return res.status(200).json({
        message: "Fetched all contacts",
        user: cached,
      });
    }

    // 1. Fetch last message timestamps per partner via raw driver covered index scans
    const MessageModel = mongoose.model("Message");
    const runAggregate = (pipeline) =>
      MessageModel.collection
        ? MessageModel.collection.aggregate(pipeline).toArray()
        : MessageModel.aggregate(pipeline);

    const [sentStats, receivedStats] = await Promise.all([
      runAggregate([
        { $match: { senderId: loginUserId } },
        { $group: { _id: "$receiverId", lastMessageTime: { $max: "$createdAt" } } },
      ]),
      runAggregate([
        { $match: { receiverId: loginUserId } },
        { $group: { _id: "$senderId", lastMessageTime: { $max: "$createdAt" } } },
      ]),
    ]);

    const lastMessageMap = new Map();
    const recordPartners = (rows) => {
      for (const row of rows) {
        if (!row._id) continue;
        const partnerId = row._id.toString();
        if (partnerId === loginUserStr) continue;
        const ts = row.lastMessageTime ? new Date(row.lastMessageTime).getTime() : 0;
        const prev = lastMessageMap.get(partnerId) || 0;
        if (ts > prev) {
          lastMessageMap.set(partnerId, ts);
        }
      }
    };
    recordPartners(sentStats);
    recordPartners(receivedStats);

    const partnerIds = Array.from(lastMessageMap.keys()).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    // 2. Sort only active conversation partners by recency
    let partnerSlice = [];
    if (partnerIds.length > 0 && skip < partnerIds.length) {
      const partnerUsers = User.collection
        ? await User.collection
            .find(
              { _id: { $in: partnerIds } },
              { projection: { fullName: 1, email: 1, profilePic: 1 } }
            )
            .toArray()
        : await User.find({ _id: { $in: partnerIds } })
            .select("fullName email profilePic")
            .lean();

      partnerUsers.sort((a, b) => {
        const timeA = lastMessageMap.get(a._id.toString()) || 0;
        const timeB = lastMessageMap.get(b._id.toString()) || 0;
        if (timeB !== timeA) return timeB - timeA;
        return compareContactNames(a, b);
      });

      partnerSlice = partnerUsers.slice(skip, skip + limit);
    }

    // 3. Fill remaining page slots from shared cached directory slice when possible
    const remainingLimit = limit - partnerSlice.length;
    let otherUsers = [];
    if (remainingLimit > 0) {
      const otherSkip = Math.max(0, skip - partnerIds.length);
      if (User.collection && otherSkip + remainingLimit <= 100) {
        const topDirectory = await getCachedDirectoryTop(() =>
          User.collection
            .find({}, { projection: { fullName: 1, email: 1, profilePic: 1 } })
            .sort({ fullName: 1, _id: 1 })
            .limit(150)
            .toArray()
        );
        const filtered = [];
        for (const u of topDirectory) {
          const idStr = u._id.toString();
          if (idStr === loginUserStr || lastMessageMap.has(idStr)) continue;
          filtered.push(u);
          if (filtered.length >= otherSkip + remainingLimit) break;
        }
        if (filtered.length >= otherSkip + remainingLimit || topDirectory.length < 150) {
          otherUsers = filtered.slice(otherSkip, otherSkip + remainingLimit);
        }
      }

      if (otherUsers.length === 0) {
        const excludeIds = [loginUserId, ...partnerIds];
        otherUsers = User.collection
          ? await User.collection
              .find(
                { _id: { $nin: excludeIds } },
                { projection: { fullName: 1, email: 1, profilePic: 1 } }
              )
              .sort({ fullName: 1, _id: 1 })
              .skip(otherSkip)
              .limit(remainingLimit)
              .toArray()
          : await User.find({ _id: { $nin: excludeIds } })
              .select("fullName email profilePic")
              .sort({ fullName: 1, _id: 1 })
              .skip(otherSkip)
              .limit(remainingLimit)
              .lean();
      }
    }

    const resultUsers = [...partnerSlice, ...otherUsers];
    setCachedContactsPage(loginUserStr, page, limit, resultUsers);

    res.status(200).json({
      message: "Fetched all contacts",
      user: resultUsers,
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
