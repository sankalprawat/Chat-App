const Group = require("../models/Group");
const GroupMessage = require("../models/GroupMessage");
const { getIO, joinGroupRoom } = require("../services/socket");

// 1. Create a New Group
const createGroup = async (req, res) => {
  try {
    const { groupName, description } = req.body;
    let membersInput = req.body.members;
    const adminId = req.user._id;

    // Handle members parsing from FormData
    if (typeof membersInput === "string") {
      try {
        membersInput = JSON.parse(membersInput);
      } catch (e) {
        membersInput = membersInput ? [membersInput] : [];
      }
    }
    if (!Array.isArray(membersInput)) {
      membersInput = membersInput ? [membersInput] : [];
    }

    // Ensure the admin is always in the member list
    const uniqueMembers = Array.from(new Set([...membersInput, adminId.toString()]));
    const groupPic = req.imageUrl && req.imageUrl[0] ? req.imageUrl[0] : "";

    const group = await Group.create({
      groupName,
      description,
      admin: adminId,
      members: uniqueMembers,
      groupPic
    });

    // Make online members join the socket.io room immediately
    joinGroupRoom(group._id, uniqueMembers);

    res.status(201).json({
      success: true,
      message: "Group created successfully",
      group
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
      .sort({ updatedAt: -1 });

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

    // Verify user is a member of the group
    const group = await Group.findOne({ _id: groupId, members: senderId });
    if (!group) {
      return res.status(403).json({ success: false, message: "Not authorized in this group" });
    }

    const newMessage = await GroupMessage.create({
      groupId,
      senderId,
      text: text || "",
      imageUrl: req.imageUrl || [],
      videoUrl: req.videoUrl || [],
      audioUrl: req.audioUrl || []
    });

    // Populate sender details for UI presentation
    const populatedMessage = await newMessage.populate("senderId", "fullName profilePic");

    // Broadcast to everyone in the socket room
    const io = getIO();
    io.to(groupId.toString()).emit("newGroupMessage", populatedMessage);

    res.status(200).json({
      success: true,
      message: "Group message sent",
      data: populatedMessage
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Verify membership
    const group = await Group.findOne({ _id: groupId, members: userId })
      .populate("members", "fullName profilePic email");
    if (!group) {
      return res.status(403).json({ success: false, message: "Unauthorized group access" });
    }

    const messages = await GroupMessage.find({ groupId })
      .populate("senderId", "fullName profilePic")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const sortedMessages = messages.reverse();

    res.status(200).json({ success: true, group, data: sortedMessages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createGroup, getUserGroups, sendGroupMessage, getGroupMessages };
