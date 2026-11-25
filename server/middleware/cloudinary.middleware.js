const cloudinary = require("../config/cloudinary");
const fs = require("fs/promises");

const uploadSingleFile = async (file) => {
  const options = {
    resource_type: "auto",
    folder: "chatingApp",
  };

  try {
    // Cloudinary limits standard uploads to 10MB on the free tier.
    const result =
      file.size > 10 * 1024 * 1024
        ? await cloudinary.uploader.upload_large(file.path, options)
        : await cloudinary.uploader.upload(file.path, options);

    return {
      mimetype: file.mimetype || "",
      secure_url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type,
    };
  } finally {
    await fs.unlink(file.path).catch(() => {});
  }
};

const uploadToCloudinary = async (req, res, next) => {
  const files = Array.isArray(req.files)
    ? req.files
    : req.file
      ? [req.file]
      : [];

  if (files.length === 0) {
    return next();
  }

  req.imageUrl = [];
  req.videoUrl = [];
  req.audioUrl = [];

  try {
    const settled = await Promise.allSettled(files.map(uploadSingleFile));
    const succeeded = [];
    let firstError = null;

    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        succeeded.push(outcome.value);
      } else if (!firstError) {
        firstError = outcome.reason;
      }
    }

    if (firstError) {
      // Clean up any partial uploads from this failed batch
      await Promise.allSettled(
        succeeded.map((item) =>
          cloudinary.uploader.destroy(item.public_id, {
            resource_type: item.resource_type || "image",
          })
        )
      );
      throw firstError;
    }

    for (const item of succeeded) {
      if (item.mimetype.startsWith("image")) {
        req.imageUrl.push(item.secure_url);
      } else if (item.mimetype.startsWith("video")) {
        req.videoUrl.push(item.secure_url);
      } else if (item.mimetype.startsWith("audio")) {
        req.audioUrl.push(item.secure_url);
      }
    }

    next();
  } catch (error) {
    console.log("uploadToCloudinary", error.message);
    res.status(500).json({ message: "cloudinary error" });
  }
};

module.exports = uploadToCloudinary;
