const { default: mongoose } = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const dbConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connection Successful to MongoDB");
  } catch (error) {
    console.error("MongoDB Error:", error);
    throw error;
  }
};

module.exports = dbConnect;
