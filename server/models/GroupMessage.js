const mongoose = require("mongoose");

const groupMessageSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      default: "",
    },
    imageUrl: [
      {
        type: String,
      },
    ],
    videoUrl: [
      {
        type: String,
      },
    ],
    audioUrl: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

groupMessageSchema.index({ groupId: 1, createdAt: -1 });

module.exports = mongoose.model("GroupMessage", groupMessageSchema);
