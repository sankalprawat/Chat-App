const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      minlength: 6,
      required: false,
      select: false,
    },
    profilePic: {
      type: String,
      default: "",
    },
    googleId: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  },
});

userSchema.set("toObject", {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  },
});

userSchema.index({ fullName: 1, _id: 1 });

const User = mongoose.model("User", userSchema);
module.exports = User;
