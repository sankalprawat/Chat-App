const express = require("express");
const {
  signUp,
  login,
  getProfile,
  updateProfile,
  getAllContacts,
  googleLogin,
} = require("../controllers/auth.controller");
const verifyToken = require("../middleware/verifyToken.middleware");
const upload = require("../middleware/multer.middleware");
const uploadToCloudinary = require("../middleware/cloudinary.middleware");
const { createRateLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Math.max(parseInt(process.env.AUTH_RATE_LIMIT_MAX || "", 10) || 30, 1),
  message: "Too many authentication attempts. Please try again later.",
});

router.post("/signup", authLimiter, signUp);
router.post("/login", authLimiter, login);
router.post("/googleLogin", authLimiter, googleLogin);
router.get("/getProfile", verifyToken, getProfile);
router.put(
  "/updateProfile",
  verifyToken,
  upload.single("profileImage"),
  uploadToCloudinary,
  updateProfile
);
router.get("/getAllContacts", verifyToken, getAllContacts);

module.exports = router;
