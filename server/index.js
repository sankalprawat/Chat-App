const express = require("express");
const dotenv = require("dotenv");
const dbConnect = require("./config/db");
const authRoute = require("./routes/auth.route");
const cors = require("cors");
const messageRoute = require("./routes/message.route");
const groupRoute = require("./routes/group.route");

const { initSocket } = require("./services/socket");

const { createServer } = require("http");

dotenv.config();

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(cors());

app.use("/api", authRoute);
app.use("/api", messageRoute);
app.use("/api", groupRoute);

const PORT = process.env.PORT || 3000;

initSocket(server);

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
