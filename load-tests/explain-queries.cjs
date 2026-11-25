const fs = require("fs");
const path = require("path");
const mongoose = require(path.resolve(__dirname, "../server/node_modules/mongoose"));
const User = require(path.resolve(__dirname, "../server/models/User"));
const Message = require(path.resolve(__dirname, "../server/models/Message"));
const Group = require(path.resolve(__dirname, "../server/models/Group"));
const GroupMessage = require(path.resolve(__dirname, "../server/models/GroupMessage"));

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27018/chatApp_loadtest";
const MANIFEST_PATH = process.env.SEED_MANIFEST;
const OUT_PATH = process.env.EXPLAIN_OUT_PATH || path.resolve(__dirname, "results/explain-plans.json");

function summarizeExplain(exp) {
  const exec = exp.executionStats || {};
  const qp = exp.queryPlanner || {};
  return {
    winningPlan: qp.winningPlan,
    nReturned: exec.nReturned,
    executionTimeMillis: exec.executionTimeMillis,
    totalKeysExamined: exec.totalKeysExamined,
    totalDocsExamined: exec.totalDocsExamined,
  };
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const u0 = new mongoose.Types.ObjectId(manifest.users[0].id);
  const u1 = new mongoose.Types.ObjectId(manifest.users[1].id);
  const g0 = new mongoose.Types.ObjectId(manifest.hotGroupId);

  const plans = {};

  plans.getAllContacts_messageAggregate = await db.command({
    explain: {
      aggregate: "messages",
      pipeline: [
        { $match: { $or: [{ senderId: u0 }, { receiverId: u0 }] } },
        {
          $group: {
            _id: { $cond: [{ $eq: ["$senderId", u0] }, "$receiverId", "$senderId"] },
            lastMessageTime: { $max: "$createdAt" },
          },
        },
      ],
      cursor: {},
    },
    verbosity: "executionStats",
  });

  plans.getAllContacts_userFind = summarizeExplain(
    await User.find({ _id: { $ne: u0 } }).select("-password").lean().explain("executionStats")
  );

  plans.getMessage_page1 = summarizeExplain(
    await Message.find({
      $or: [
        { senderId: u0, receiverId: u1 },
        { senderId: u1, receiverId: u0 },
      ],
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(50)
      .lean()
      .explain("executionStats")
  );

  plans.getMessage_page20_skip = summarizeExplain(
    await Message.find({
      $or: [
        { senderId: u0, receiverId: u1 },
        { senderId: u1, receiverId: u0 },
      ],
    })
      .sort({ createdAt: -1, _id: -1 })
      .skip(950)
      .limit(50)
      .lean()
      .explain("executionStats")
  );

  plans.getUserGroups = summarizeExplain(
    await Group.find({ members: u0 }).sort({ updatedAt: -1 }).lean().explain("executionStats")
  );

  plans.getGroupMessages_page1 = summarizeExplain(
    await GroupMessage.find({ groupId: g0 })
      .sort({ createdAt: -1, _id: -1 })
      .limit(50)
      .lean()
      .explain("executionStats")
  );

  plans.getGroupMessages_page9_skip = summarizeExplain(
    await GroupMessage.find({ groupId: g0 })
      .sort({ createdAt: -1, _id: -1 })
      .skip(400)
      .limit(50)
      .lean()
      .explain("executionStats")
  );

  plans.login_findUser = summarizeExplain(
    await User.findOne({ email: "user0@loadtest.local" }).select("+password").explain("executionStats")
  );

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(plans, null, 2));
  console.log("Wrote MongoDB explain plans to", OUT_PATH);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
