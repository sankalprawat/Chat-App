const { Server } = require("socket.io");
const socketAuth = require("../middleware/socket.auth.middleware");
const Group = require("../models/Group");

let io;
const userSocketMap = {}; // Maps userId to a Set of socketIds

const initSocket = async (server, corsOrigin = "*") => {
  io = new Server(server, {
    cors: { origin: corsOrigin },
  });
  io.use(socketAuth);

  io.on("connection", async (socket) => {
    console.log("user connected", socket.user.fullName);

    const userId = socket.userId.toString();
    const wasOffline = !userSocketMap[userId];

    if (wasOffline) {
      userSocketMap[userId] = new Set();
    }
    userSocketMap[userId].add(socket.id);

    socket.join(userId);

    // Join user to all group rooms they are members of
    try {
      const userGroups = await Group.find({ members: userId }).select("_id").lean();
      userGroups.forEach((group) => {
        socket.join(group._id.toString());
      });
    } catch (err) {
      console.error("Error joining group socket rooms on connection:", err);
    }

    const onlineUserIds = Object.keys(userSocketMap);
    if (wasOffline) {
      // Broadcast only when a user actually transitions from offline -> online
      io.emit("onlineUser", onlineUserIds);
    } else {
      // New tab of an already-online user only needs the current snapshot
      socket.emit("onlineUser", onlineUserIds);
    }

    socket.on("disconnect", () => {
      if (userSocketMap[userId]) {
        userSocketMap[userId].delete(socket.id);
        if (userSocketMap[userId].size === 0) {
          delete userSocketMap[userId];
          // Broadcast only when the user's last socket disconnects
          io.emit("onlineUser", Object.keys(userSocketMap));
        }
      }
    });
  });
  return io;
};

const getIO = () => {
  return io;
};

/**
 * Dynamically adds active sockets for specific members into a group room
 */
const joinGroupRoom = (groupId, memberIds) => {
  if (!io) return;
  memberIds.forEach((memberId) => {
    const socketIds = userSocketMap[memberId.toString()];
    if (socketIds) {
      socketIds.forEach((socketId) => {
        const socketInstance = io.sockets.sockets.get(socketId);
        if (socketInstance) {
          socketInstance.join(groupId.toString());
        }
      });
    }
  });
};

module.exports = { initSocket, getIO, joinGroupRoom };
