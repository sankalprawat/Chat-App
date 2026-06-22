const cloudinary = require("../config/cloudinary");
const fs = require("fs");

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
      try {
        // Cloudinary limits standard uploads to 10MB on the free tier.
        // For larger files (like videos), we must use the chunked 'upload_large' method.
        const options = {
          resource_type: "auto",
          folder: "chatingApp",
        };

        const result = file.size > 10 * 1024 * 1024 
          ? await cloudinary.uploader.upload_large(file.path, options)
          : await cloudinary.uploader.upload(file.path, options);
        
        if (file.mimetype.startsWith("image")) {
          req.imageUrl.push(result.secure_url);
        }
        if (file.mimetype.startsWith("video")) {
          req.videoUrl.push(result.secure_url);
        }
        if (file.mimetype.startsWith("audio")) {
          req.audioUrl.push(result.secure_url);
        }
      } finally {
        // Clean up the temporary file from the local server disk
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }
    next();
  } catch (error) {
    console.log("uploadToCloudinary", error.message);
    res.status(500).json({ message: "cloudinary error" });
  }
};
module.exports = uploadToCloudinary;
