const express = require("express");
const {
  createGroup,
  getUserGroups,
  sendGroupMessage,
  getGroupMessages
} = require("../controllers/group.controller");
const verifyToken = require("../middleware/verifyToken.middleware");
const upload = require("../middleware/multer.middleware");
const uploadToCloudinary = require("../middleware/cloudinary.middleware");

const router = express.Router();

router.post(
  "/groups/create",
  verifyToken,
  upload.single("groupPic"),
  uploadToCloudinary,
  createGroup
);
router.get("/groups", verifyToken, getUserGroups);
router.get("/groups/:groupId/messages", verifyToken, getGroupMessages);
router.post(
  "/groups/:groupId/send",
  verifyToken,
  upload.array("files"),
  uploadToCloudinary,
  sendGroupMessage
);

module.exports = router;
