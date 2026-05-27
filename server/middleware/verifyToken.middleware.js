const jwt = require("jsonwebtoken");
const User = require("../models/User");

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    const token = authHeader.split(" ")[1];
    console.log(token);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);

    const user = await User.findById(decoded.userId).select("-password");
    console.log(user);

    if (!user) {
      return req.status(400).json({
        message: "User not found",
      });
    }

    req.user = user ;
    next();

  } catch (error) {
    console.log("JWT verification error: ", error.message);
  }
};

module.exports = verifyToken;
