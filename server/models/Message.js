const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
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

// Compound indexes covering both $or branches and createdAt sort order
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
