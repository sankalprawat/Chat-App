const { authenticateJwtToken } = require("../services/authCache");

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.headers?.token || socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("No token provided"));
    }
    const user = await authenticateJwtToken(token);
    if (!user) {
      return next(new Error("User not found"));
    }
    socket.user = user;
    socket.userId = user._id;
    next();
  } catch (error) {
    console.error("Socket Auth Error:", error.message);
    next(new Error("Unauthorized"));
  }
};

module.exports = socketAuth;
