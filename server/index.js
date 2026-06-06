const express = require("express");
const dotenv = require("dotenv");
const dbConnect = require("./config/db");
const authRoute = require("./routes/auth.route");
const cors = require("cors")
const {Server} = require("socket.io")

dotenv.config();

const app = express();

app.use(express.json())
app.use(cors())

app.use("/api", authRoute);

let PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running port ${PORT}`);
  dbConnect();
});
