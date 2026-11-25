const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const { getIO } = require("../services/socket");
const { invalidateContactsForUsers } = require("../services/authCache");

const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(userId).select("-password").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({
      message: "user get successfully",
      data: user,
    });
  } catch (error) {
    console.log("error getUserById ", error.message);
    res.status(500).json({ message: error.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    const { receiverId } = req.params;
    const senderId = req.user._id;

    if (!mongoose.isValidObjectId(receiverId)) {
      return res.status(400).json({ message: "Invalid receiver ID" });
    }

    const trimmedText = typeof text === "string" ? text.trim() : "";
    const imageUrl = req.imageUrl || [];
    const videoUrl = req.videoUrl || [];
    const audioUrl = req.audioUrl || [];

    if (
      !trimmedText &&
      imageUrl.length === 0 &&
      videoUrl.length === 0 &&
      audioUrl.length === 0
    ) {
      return res.status(400).json({ message: "Message content cannot be empty" });
    }

    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text: trimmedText,
      imageUrl,
      videoUrl,
      audioUrl,
    });
    invalidateContactsForUsers(senderId, receiverId);

    const io = getIO();
    if (io) {
      const receiverRoom = receiverId.toString();
      const senderRoom = senderId.toString();
      io.to(receiverRoom).emit("newMessage", newMessage);
      if (senderRoom !== receiverRoom) {
        io.to(senderRoom).emit("newMessage", newMessage);
      }
    }

    res.status(200).json({
      message: "message send successfully",
      data: newMessage,
    });
  } catch (error) {
    console.log("error sendMessage ", error.message);
    res.status(500).json({ message: error.message });
  }
};

const getMessage = async (req, res) => {
  try {
    const loginUserId = req.user._id;
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const before = req.query.before;
    const beforeId = req.query.beforeId;

    const participantsMatch = {
      $or: [
        { senderId: loginUserId, receiverId: userId },
        { senderId: userId, receiverId: loginUserId },
      ],
    };

    let messages;
    if (before) {
      const beforeDate = new Date(before);
      if (Number.isNaN(beforeDate.getTime())) {
        return res.status(400).json({ message: "Invalid cursor timestamp" });
      }
      const cursorCondition =
        beforeId && mongoose.isValidObjectId(beforeId)
          ? {
              $or: [
                { createdAt: { $lt: beforeDate } },
                {
                  createdAt: beforeDate,
                  _id: { $lt: new mongoose.Types.ObjectId(beforeId) },
                },
              ],
            }
          : { createdAt: { $lt: beforeDate } };

      messages = await Message.find({ $and: [participantsMatch, cursorCondition] })
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .lean();
    } else {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const skip = (page - 1) * limit;
      if (process.env.NODE_ENV !== "test" && Message.collection) {
        const loginObjId = new mongoose.Types.ObjectId(loginUserId);
        const peerObjId = new mongoose.Types.ObjectId(userId);
        messages = await Message.collection
          .find({
            $or: [
              { senderId: loginObjId, receiverId: peerObjId },
              { senderId: peerObjId, receiverId: loginObjId },
            ],
          })
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();
      } else {
        messages = await Message.find(participantsMatch)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean();
      }
    }

    const sortedMessages = messages.reverse();

    res.status(200).json({
      message: "message get successfully",
      data: sortedMessages,
    });
  } catch (error) {
    console.log("error getMessage ", error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getUserById, sendMessage, getMessage };
