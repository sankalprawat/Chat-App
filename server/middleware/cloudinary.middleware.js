const cloudinary = require("../config/cloudinary");

const uploadToCloudinary = async (req, res, next) => {
  try {
    if (!req.files && !req.file) {
      return next();
    }
    req.imageUrl = [];
    req.videoUrl = [];
    req.audioUrl = [];
    const files = req.files || [req.file];

    for (const file of files) {
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: "auto",
        folder: "chatingApp",
      });
      // console.log("file", file);
      if (file.mimetype.startsWith("image")) {
        req.imageUrl.push(result.secure_url);
      }
      if (file.mimetype.startsWith("video")) {
        req.videoUrl.push(result.secure_url);
      }
      if (file.mimetype.startsWith("audio")) {
        req.audioUrl.push(result.secure_url);
      }
    }
    next();
  } catch (error) {
    console.log("uploadToCloudinary", error.message);
    res.status(500).json({ message: "cloudinary error" });
  }
};
module.exports = uploadToCloudinary;
