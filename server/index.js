const express = require("express");
const dotenv = require("dotenv");
const dbConnect = require("./config/db");
const authRoute = require("./routes/auth.route");
const cors = require("cors");
const messageRoute = require("./routes/message.route");

const { initSocket } = require("./services/socket");

const { createServer } = require("http");

dotenv.config();

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(cors());

app.use("/api", authRoute);
app.use("/api", messageRoute);

let PORT = process.env.PORT || 3000;

initSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running port ${PORT}`);
  dbConnect();
});
