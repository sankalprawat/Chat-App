const mongoose = require("mongoose");
const Group = require("../models/Group");
const GroupMessage = require("../models/GroupMessage");
const { getIO, joinGroupRoom } = require("../services/socket");

// 1. Create a New Group
const createGroup = async (req, res) => {
  try {
    const { groupName, description } = req.body;
    if (typeof groupName !== "string" || !groupName.trim()) {
      return res.status(400).json({ success: false, message: "Group name is required" });
    }
    const trimmedGroupName = groupName.trim();
    if (trimmedGroupName.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Group name cannot exceed 50 characters",
      });
    }

    let membersInput = req.body.members;
    const adminId = req.user._id;

    // Handle members parsing from FormData
    if (typeof membersInput === "string") {
      try {
        membersInput = JSON.parse(membersInput);
      } catch {
        membersInput = membersInput ? [membersInput] : [];
      }
    }
    if (!Array.isArray(membersInput)) {
      membersInput = membersInput ? [membersInput] : [];
    }

    for (const memberId of membersInput) {
      if (!mongoose.isValidObjectId(memberId)) {
        return res.status(400).json({ success: false, message: "Invalid member ID" });
      }
    }

    const uniqueMembers = Array.from(
      new Set([...membersInput.map(String), adminId.toString()])
    );
    const groupPic =
      Array.isArray(req.imageUrl) && req.imageUrl[0] ? req.imageUrl[0] : "";

    const group = await Group.create({
      groupName: trimmedGroupName,
      description: typeof description === "string" ? description.trim() : "",
      admin: adminId,
      members: uniqueMembers,
      groupPic,
    });

    await group.populate([
      { path: "admin", select: "fullName email profilePic" },
      { path: "members", select: "fullName email profilePic" },
    ]);

    // Make online members join the socket.io room immediately & notify their sidebars
    joinGroupRoom(group._id, uniqueMembers);
    const io = getIO();
    if (io) {
      uniqueMembers.forEach((memberId) => {
        io.to(memberId).emit("groupCreated", group);
      });
    }

    res.status(201).json({
      success: true,
      message: "Group created successfully",
      group,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get All Groups Joined by Logged In User
const getUserGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({ members: userId })
      .populate("admin", "fullName email profilePic")
      .populate("members", "fullName email profilePic")
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json({ success: true, groups });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Send Message to a Group
const sendGroupMessage = async (req, res) => {
  try {
    const { text } = req.body;
    const { groupId } = req.params;
    const senderId = req.user._id;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({ success: false, message: "Invalid group ID" });
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
      return res.status(400).json({ success: false, message: "Message content cannot be empty" });
    }

    // Verify user is a member of the group
    const isMember = await Group.exists({ _id: groupId, members: senderId });
    if (!isMember) {
      return res.status(403).json({ success: false, message: "Not authorized in this group" });
    }

    const newMessage = await GroupMessage.create({
      groupId,
      senderId,
      text: trimmedText,
      imageUrl,
      videoUrl,
      audioUrl,
    });

    const [populatedMessage] = await Promise.all([
      newMessage.populate("senderId", "fullName profilePic"),
      Group.findByIdAndUpdate(groupId, { updatedAt: new Date() }),
    ]);

    // Broadcast to everyone in the socket room
    const io = getIO();
    if (io) {
      io.to(groupId.toString()).emit("newGroupMessage", populatedMessage);
    }

    res.status(200).json({
      success: true,
      message: "Group message sent",
      data: populatedMessage,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Retrieve Group Messages History
const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({ success: false, message: "Invalid group ID" });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const before = req.query.before;
    const beforeId = req.query.beforeId;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const isInitialFetch = !before && page === 1;

    // Fetch full group details only on initial load; subsequent pages just verify membership
    let group = null;
    if (isInitialFetch) {
      group = await Group.findOne({ _id: groupId, members: userId })
        .populate("members", "fullName profilePic email")
        .lean();
      if (!group) {
        return res.status(403).json({ success: false, message: "Unauthorized group access" });
      }
    } else {
      const isMember = await Group.exists({ _id: groupId, members: userId });
      if (!isMember) {
        return res.status(403).json({ success: false, message: "Unauthorized group access" });
      }
    }

    let query;
    if (before) {
      const beforeDate = new Date(before);
      if (Number.isNaN(beforeDate.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid cursor timestamp" });
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

      query = GroupMessage.find({ groupId, ...cursorCondition })
        .populate("senderId", "fullName profilePic")
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .lean();
    } else {
      const skip = (page - 1) * limit;
      query = GroupMessage.find({ groupId })
        .populate("senderId", "fullName profilePic")
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    }

    const messages = await query;
    const sortedMessages = messages.reverse();

    res.status(200).json({
      success: true,
      ...(group ? { group } : {}),
      data: sortedMessages,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createGroup, getUserGroups, sendGroupMessage, getGroupMessages };
