const fs = require("fs");
const path = require("path");
const mongoose = require(path.resolve(__dirname, "../server/node_modules/mongoose"));
const bcrypt = require(path.resolve(__dirname, "../server/node_modules/bcryptjs"));
const jwt = require(path.resolve(__dirname, "../server/node_modules/jsonwebtoken"));

const User = require(path.resolve(__dirname, "../server/models/User"));
const Message = require(path.resolve(__dirname, "../server/models/Message"));
const Group = require(path.resolve(__dirname, "../server/models/Group"));
const GroupMessage = require(path.resolve(__dirname, "../server/models/GroupMessage"));

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27018/chatApp_loadtest";
const JWT_SECRET = process.env.JWT_SECRET || "loadtest-local-jwt-secret-only";
const MANIFEST_PATH =
  process.env.SEED_MANIFEST ||
  path.resolve(__dirname, "../load-tests/.tmp-seed-manifest.json");

const TOTAL_USERS = 1000;
const TOTAL_DMS = 50000;
const TOTAL_GROUPS = 50;
const MEMBERS_PER_GROUP = 20;
const TOTAL_GROUP_MSGS = 25000;

async function main() {
  const start = Date.now();
  await mongoose.connect(MONGO_URI);
  console.log(`Connected to ${MONGO_URI}`);

  await mongoose.connection.dropDatabase();

  await Promise.all([
    User.syncIndexes(),
    Message.syncIndexes(),
    Group.syncIndexes(),
    GroupMessage.syncIndexes(),
  ]);

  const hashedPassword = await bcrypt.hash("TestPass123!", 10);
  const userDocs = [];
  for (let i = 0; i < TOTAL_USERS; i++) {
    userDocs.push({
      fullName: `Load User ${String(i).padStart(4, "0")}`,
      email: `user${i}@loadtest.local`,
      password: hashedPassword,
      profilePic: "",
    });
  }
  const insertedUsers = await User.insertMany(userDocs, { ordered: false });
  console.log(`Inserted ${insertedUsers.length} users`);

  // Seed 50,000 DMs:
  // First 15,000 messages give user0..user49 rich conversation history (~300 msgs each across 20 contacts)
  // Remaining 35,000 distributed across users
  const now = Date.now();
  const BATCH_SIZE = 5000;
  let dmCount = 0;
  let batch = [];

  const flushDm = async () => {
    if (batch.length > 0) {
      await Message.collection.insertMany(batch, { ordered: false });
      batch = [];
    }
  };

  for (let i = 0; i < TOTAL_DMS; i++) {
    let senderIdx;
    let receiverIdx;
    if (i < 15000) {
      senderIdx = i % 50;
      const partnerOffset = 1 + ((Math.floor(i / 50) * 7) % 25);
      receiverIdx = (senderIdx + partnerOffset) % 100;
    } else {
      senderIdx = i % TOTAL_USERS;
      receiverIdx = (senderIdx + 1 + (i % 50)) % TOTAL_USERS;
    }
    const createdAt = new Date(now - (TOTAL_DMS - i) * 1000);
    batch.push({
      senderId: insertedUsers[senderIdx]._id,
      receiverId: insertedUsers[receiverIdx]._id,
      text: `DM payload #${i} - benchmark message text for realistic sizing`,
      imageUrl: [],
      videoUrl: [],
      audioUrl: [],
      createdAt,
      updatedAt: createdAt,
    });
    dmCount++;
    if (batch.length >= BATCH_SIZE) {
      await flushDm();
    }
  }
  await flushDm();
  console.log(`Inserted ${dmCount} DMs`);

  // Seed 50 Groups with 20 members each:
  // Groups 0..9 all include user0..user19 so primary test users belong to 10 groups each (matching predictions)
  const groupDocs = [];
  for (let g = 0; g < TOTAL_GROUPS; g++) {
    const memberIds = [];
    if (g < 10) {
      for (let m = 0; m < MEMBERS_PER_GROUP; m++) {
        memberIds.push(insertedUsers[m]._id);
      }
    } else {
      const startIdx = (g * 19) % TOTAL_USERS;
      for (let m = 0; m < MEMBERS_PER_GROUP; m++) {
        memberIds.push(insertedUsers[(startIdx + m) % TOTAL_USERS]._id);
      }
    }
    const ts = new Date(now - (TOTAL_GROUPS - g) * 60000);
    groupDocs.push({
      groupName: `Load Group ${g}`,
      description: `Load testing group #${g}`,
      groupPic: "",
      admin: memberIds[0],
      members: memberIds,
      createdAt: ts,
      updatedAt: ts,
    });
  }
  const insertedGroups = await Group.insertMany(groupDocs, { ordered: false });
  console.log(`Inserted ${insertedGroups.length} groups`);

  // Seed 25,000 GroupMessages (500 per group)
  let gmBatch = [];
  for (let i = 0; i < TOTAL_GROUP_MSGS; i++) {
    const group = insertedGroups[i % TOTAL_GROUPS];
    const sender = group.members[i % group.members.length];
    const createdAt = new Date(now - (TOTAL_GROUP_MSGS - i) * 1000);
    gmBatch.push({
      groupId: group._id,
      senderId: sender,
      text: `Group msg #${i} in ${group.groupName} for realistic payload size`,
      imageUrl: [],
      videoUrl: [],
      audioUrl: [],
      createdAt,
      updatedAt: createdAt,
    });
    if (gmBatch.length >= BATCH_SIZE) {
      await GroupMessage.collection.insertMany(gmBatch, { ordered: false });
      gmBatch = [];
    }
  }
  if (gmBatch.length > 0) {
    await GroupMessage.collection.insertMany(gmBatch, { ordered: false });
  }
  console.log(`Inserted ${TOTAL_GROUP_MSGS} group messages`);

  // Mint tokens for first 600 users (used by VUs across HTTP and 500-user WS storm tests)
  const testUsers = insertedUsers.slice(0, 600).map((u, idx) => ({
    index: idx,
    id: u._id.toString(),
    email: u.email,
    fullName: u.fullName,
    token: jwt.sign(
      { userId: u._id.toString(), fullName: u.fullName, email: u.email },
      JWT_SECRET,
      { expiresIn: "365d" }
    ),
  }));

  const manifest = {
    generatedAt: new Date().toISOString(),
    counts: {
      users: TOTAL_USERS,
      messages: TOTAL_DMS,
      groups: TOTAL_GROUPS,
      membersPerGroup: MEMBERS_PER_GROUP,
      groupMessages: TOTAL_GROUP_MSGS,
    },
    users: testUsers,
    hotGroupId: insertedGroups[0]._id.toString(),
    groupIds: insertedGroups.slice(0, 10).map((g) => g._id.toString()),
    allGroupIds: insertedGroups.map((g) => g._id.toString()),
  };

  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest));

  const indexes = {
    users: await User.collection.indexes(),
    messages: await Message.collection.indexes(),
    groups: await Group.collection.indexes(),
    groupmessages: await GroupMessage.collection.indexes(),
  };
  console.log("Indexes verified:", Object.keys(indexes).map((k) => `${k}:${indexes[k].length}`).join(", "));
  console.log(`Seed completed in ${((Date.now() - start) / 1000).toFixed(2)}s`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
