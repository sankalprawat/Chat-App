const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

if (!fs.existsSync("uploads/")) {
  fs.mkdirSync("uploads/", { recursive: true });
}

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, "uploads/");
  },
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname || "").slice(0, 16).replace(/[^a-zA-Z0-9.]/g, "");
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req, file, cb) => {
  const isAllowed = ALLOWED_MIME_PREFIXES.some((prefix) =>
    file.mimetype?.startsWith(prefix)
  );
  if (!isAllowed) {
    const err = new Error("Unsupported file type. Only image, video, and audio files are allowed.");
    err.statusCode = 400;
    return cb(err, false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024, files: 10 },
});

module.exports = upload;
