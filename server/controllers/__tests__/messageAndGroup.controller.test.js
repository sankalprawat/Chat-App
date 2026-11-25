const mongoose = require("mongoose");
const Message = require("../../models/Message");
const User = require("../../models/User");
const Group = require("../../models/Group");
const GroupMessage = require("../../models/GroupMessage");
const { getIO, joinGroupRoom } = require("../../services/socket");
const { sendMessage, getMessage } = require("../message.controller");
const {
  createGroup,
  sendGroupMessage,
  getGroupMessages,
} = require("../group.controller");

jest.mock("../../models/Message");
jest.mock("../../models/User");
jest.mock("../../models/Group");
jest.mock("../../models/GroupMessage");
jest.mock("../../services/socket");

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("Message and Group Controllers", () => {
  const validId1 = new mongoose.Types.ObjectId().toString();
  const validId2 = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  describe("Message Controller", () => {
    it("rejects invalid receiverId with 400", async () => {
      const req = {
        user: { _id: validId1 },
        params: { receiverId: "invalid-id" },
        body: { text: "hello" },
      };
      const res = createRes();

      await sendMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("rejects empty whitespace message without media", async () => {
      const req = {
        user: { _id: validId1 },
        params: { receiverId: validId2 },
        body: { text: "   " },
      };
      const res = createRes();

      await sendMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(Message.create).not.toHaveBeenCalled();
    });

    it("uses User.exists and emits once for self-DM", async () => {
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      getIO.mockReturnValue({ to: toMock });

      User.exists.mockResolvedValue({ _id: validId1 });
      Message.create.mockResolvedValue({ _id: "m1", text: "note" });

      const req = {
        user: { _id: validId1 },
        params: { receiverId: validId1 },
        body: { text: "note" },
      };
      const res = createRes();

      await sendMessage(req, res);

      expect(User.exists).toHaveBeenCalledWith({ _id: validId1 });
      expect(toMock).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects invalid cursor timestamp in getMessage", async () => {
      const req = {
        user: { _id: validId1 },
        params: { userId: validId2 },
        query: { before: "not-a-date" },
      };
      const res = createRes();

      await getMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("Group Controller", () => {
    it("rejects invalid member ID in createGroup", async () => {
      const req = {
        user: { _id: validId1 },
        body: { groupName: "Team", members: ["bad-id"] },
      };
      const res = createRes();

      await createGroup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(Group.create).not.toHaveBeenCalled();
    });

    it("emits groupCreated to all members on createGroup", async () => {
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      getIO.mockReturnValue({ to: toMock });

      const groupObj = {
        _id: validId2,
        groupName: "Team",
        populate: jest.fn().mockResolvedValue(true),
      };
      Group.create.mockResolvedValue(groupObj);

      const req = {
        user: { _id: validId1 },
        body: { groupName: "Team", members: JSON.stringify([validId2]) },
      };
      const res = createRes();

      await createGroup(req, res);

      expect(joinGroupRoom).toHaveBeenCalledWith(validId2, [validId2, validId1]);
      expect(toMock).toHaveBeenCalledWith(validId2);
      expect(toMock).toHaveBeenCalledWith(validId1);
      expect(emitMock).toHaveBeenCalledWith("groupCreated", groupObj);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("sendGroupMessage updates Group.updatedAt and broadcasts", async () => {
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      getIO.mockReturnValue({ to: toMock });

      Group.exists.mockResolvedValue({ _id: validId2 });
      const populatedMsg = { _id: "gm1", text: "Hi group" };
      GroupMessage.create.mockResolvedValue({
        populate: jest.fn().mockResolvedValue(populatedMsg),
      });
      Group.findByIdAndUpdate.mockResolvedValue({});

      const req = {
        user: { _id: validId1 },
        params: { groupId: validId2 },
        body: { text: "Hi group" },
      };
      const res = createRes();

      await sendGroupMessage(req, res);

      expect(Group.findByIdAndUpdate).toHaveBeenCalledWith(validId2, {
        updatedAt: expect.any(Date),
      });
      expect(toMock).toHaveBeenCalledWith(validId2);
      expect(emitMock).toHaveBeenCalledWith("newGroupMessage", populatedMsg);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("getGroupMessages skips full group populate when before cursor is used", async () => {
      Group.exists.mockResolvedValue({ _id: validId2 });
      const leanMock = jest.fn().mockResolvedValue([]);
      const limitMock = jest.fn().mockReturnValue({ lean: leanMock });
      const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
      const populateMock = jest.fn().mockReturnValue({ sort: sortMock });
      GroupMessage.find.mockReturnValue({ populate: populateMock });

      const req = {
        user: { _id: validId1 },
        params: { groupId: validId2 },
        query: { before: "2026-01-01T00:00:00.000Z" },
      };
      const res = createRes();

      await getGroupMessages(req, res);

      expect(Group.exists).toHaveBeenCalled();
      expect(Group.findOne).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].group).toBeUndefined();
    });
  });
});
