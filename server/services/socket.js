const { Server } = require("socket.io");
const mongoose = require("mongoose");
const socketAuth = require("../middleware/socket.auth.middleware");
const Group = require("../models/Group");

const PRESENCE_FLUSH_MS = 250;

let io;
const userSocketMap = new Map(); // Maps userId to a Set of socketIds
const pendingOnline = new Set();
const pendingOffline = new Set();
let presenceFlushTimer = null;

function flushPresenceDeltas() {
  presenceFlushTimer = null;
  if (!io || (pendingOnline.size === 0 && pendingOffline.size === 0)) {
    pendingOnline.clear();
    pendingOffline.clear();
    return;
  }
  const delta = {
    online: Array.from(pendingOnline),
    offline: Array.from(pendingOffline),
  };
  pendingOnline.clear();
  pendingOffline.clear();
  io.emit("presenceDelta", delta);
}

function schedulePresenceFlush() {
  if (presenceFlushTimer) return;
  presenceFlushTimer = setTimeout(flushPresenceDeltas, PRESENCE_FLUSH_MS);
  if (typeof presenceFlushTimer.unref === "function") {
    presenceFlushTimer.unref();
  }
}

const initSocket = async (server, corsOrigin = "*") => {
  io = new Server(server, {
    cors: { origin: corsOrigin },
  });
  io.use(socketAuth);

  io.on("connection", async (socket) => {
    const userId = socket.userId.toString();
    let sockets = userSocketMap.get(userId);
    const wasOffline = !sockets;

    if (wasOffline) {
      sockets = new Set();
      userSocketMap.set(userId, sockets);
    }
    sockets.add(socket.id);

    socket.join(userId);

    // Join user to all group rooms they are members of via raw driver query
    try {
      const memberFilter = mongoose.isValidObjectId(userId)
        ? new mongoose.Types.ObjectId(userId)
        : socket.userId;
      const userGroups = Group.collection
        ? await Group.collection
            .find({ members: memberFilter }, { projection: { _id: 1 } })
            .toArray()
        : await Group.find({ members: userId }).select("_id").lean();
      for (const group of userGroups) {
        socket.join(group._id.toString());
      }
    } catch (err) {
      console.error("Error joining group socket rooms on connection:", err);
    }

    // Send full online snapshot only to the connecting socket; coalesce presence deltas
    socket.emit("onlineUser", Array.from(userSocketMap.keys()));
    if (wasOffline) {
      pendingOffline.delete(userId);
      pendingOnline.add(userId);
      schedulePresenceFlush();
    }

    socket.on("disconnect", () => {
      const userSockets = userSocketMap.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          userSocketMap.delete(userId);
          pendingOnline.delete(userId);
          pendingOffline.add(userId);
          schedulePresenceFlush();
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
    const socketIds = userSocketMap.get(memberId.toString());
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
