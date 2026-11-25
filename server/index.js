const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const multer = require("multer");
const mongoose = require("mongoose");
const { createServer } = require("http");

dotenv.config();

const dbConnect = require("./config/db");
const authRoute = require("./routes/auth.route");
const messageRoute = require("./routes/message.route");
const groupRoute = require("./routes/group.route");
const { initSocket } = require("./services/socket");

const app = express();
const server = createServer(app);
app.set("trust proxy", 1);

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((o) => o.trim()).filter(Boolean)
  : "*";

app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: allowedOrigins }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    db: mongoose.connection.readyState === 1 ? "connected" : "connecting",
  });
});

app.use("/api", authRoute);
app.use("/api", messageRoute);
app.use("/api", groupRoute);

// Global JSON error handler (Multer errors, invalid JSON, custom statusCode errors)
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }
  const status = err.statusCode || err.status || 500;
  const message = status >= 500 ? "Internal server error" : err.message;
  if (status >= 500) {
    console.error("Unhandled server error:", err);
  }
  return res.status(status).json({ message });
});

const PORT = process.env.PORT || 3000;

initSocket(server, allowedOrigins);

dbConnect()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server is running port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });
