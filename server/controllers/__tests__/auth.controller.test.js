const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const { verifyFirebaseIdToken } = require("../../services/firebaseAuth");
const {
  signUp,
  login,
  googleLogin,
  getProfile,
  updateProfile,
} = require("../auth.controller");

jest.mock("../../models/User");
jest.mock("../../services/firebaseAuth");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("Auth Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  describe("signUp", () => {
    it("rejects passwords shorter than 6 characters before hashing", async () => {
      const req = {
        body: { fullName: "Alice", email: "alice@test.com", password: "123" },
      };
      const res = createRes();

      await signUp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(User.create).not.toHaveBeenCalled();
    });

    it("rejects invalid email format", async () => {
      const req = {
        body: { fullName: "Alice", email: "not-an-email", password: "password123" },
      };
      const res = createRes();

      await signUp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(User.create).not.toHaveBeenCalled();
    });

    it("creates user and strips password via toJSON", async () => {
      const req = {
        body: {
          fullName: "  Alice  ",
          email: "ALICE@test.com ",
          password: "password123",
        },
      };
      const res = createRes();

      User.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      bcrypt.hash.mockResolvedValue("hashed_pw");
      User.create.mockResolvedValue({
        _id: "u1",
        fullName: "Alice",
        email: "alice@test.com",
        toJSON: () => ({ _id: "u1", fullName: "Alice", email: "alice@test.com" }),
      });

      await signUp(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ email: "alice@test.com" });
      expect(res.status).toHaveBeenCalledWith(201);
      const responseData = res.json.mock.calls[0][0].data;
      expect(responseData.password).toBeUndefined();
    });
  });

  describe("login", () => {
    it("explicitly selects +password and returns sanitized user", async () => {
      const req = {
        body: { email: "Alice@Test.com", password: "password123" },
      };
      const res = createRes();
      const userDoc = {
        _id: "u1",
        fullName: "Alice",
        email: "alice@test.com",
        password: "hashed_password",
        toJSON: () => ({ _id: "u1", fullName: "Alice", email: "alice@test.com" }),
      };

      const selectMock = jest.fn().mockResolvedValue(userDoc);
      User.findOne.mockReturnValue({ select: selectMock });
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue("signed-jwt");

      await login(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ email: "alice@test.com" });
      expect(selectMock).toHaveBeenCalledWith("+password");
      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0].data;
      expect(payload.token).toBe("signed-jwt");
      expect(payload.user.password).toBeUndefined();
    });
  });

  describe("googleLogin", () => {
    it("verifies idToken server-side and rejects googleId mismatch", async () => {
      const req = {
        body: { idToken: "valid-firebase-token", email: "attacker@spoof.com" },
      };
      const res = createRes();

      verifyFirebaseIdToken.mockResolvedValue({
        googleId: "google-uid-new",
        email: "victim@test.com",
        fullName: "Victim Name",
        profilePic: "https://example.com/new.jpg",
      });

      User.findOne.mockResolvedValue({
        _id: "u2",
        email: "victim@test.com",
        googleId: "google-uid-original",
        fullName: "Original Name",
      });

      await googleLogin(req, res);

      expect(verifyFirebaseIdToken).toHaveBeenCalledWith("valid-firebase-token");
      expect(User.findOne).toHaveBeenCalledWith({ email: "victim@test.com" });
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("does not overwrite existing fullName/profilePic on returning user", async () => {
      const req = { body: { idToken: "valid-firebase-token" } };
      const res = createRes();
      const saveMock = jest.fn().mockResolvedValue(true);
      const userDoc = {
        _id: "u2",
        email: "alice@test.com",
        googleId: "g-123",
        fullName: "Custom Name",
        profilePic: "https://custom.pic/avatar.png",
        save: saveMock,
        toJSON: () => ({
          _id: "u2",
          email: "alice@test.com",
          fullName: "Custom Name",
          profilePic: "https://custom.pic/avatar.png",
        }),
      };

      verifyFirebaseIdToken.mockResolvedValue({
        googleId: "g-123",
        email: "alice@test.com",
        fullName: "Google Display Name",
        profilePic: "https://google.pic/photo.jpg",
      });
      User.findOne.mockResolvedValue(userDoc);
      jwt.sign.mockReturnValue("jwt-token");

      await googleLogin(req, res);

      expect(saveMock).not.toHaveBeenCalled();
      expect(userDoc.fullName).toBe("Custom Name");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getProfile & updateProfile", () => {
    it("getProfile returns req.user without redundant DB query", async () => {
      const req = { user: { _id: "u1", fullName: "Alice" } };
      const res = createRes();

      await getProfile(req, res);

      expect(User.findById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "This is profile page",
        user: req.user,
      });
    });

    it("updateProfile ignores empty req.imageUrl and selects without password", async () => {
      const req = {
        user: { _id: "u1" },
        body: { fullName: "  Alice Updated  " },
        imageUrl: [],
      };
      const res = createRes();

      const updatedDoc = {
        _id: "u1",
        fullName: "Alice Updated",
        toJSON: () => ({ _id: "u1", fullName: "Alice Updated" }),
      };
      const selectMock = jest.fn().mockResolvedValue(updatedDoc);
      User.findByIdAndUpdate.mockReturnValue({ select: selectMock });

      await updateProfile(req, res);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "u1",
        { fullName: "Alice Updated" },
        { new: true, runValidators: true }
      );
      expect(selectMock).toHaveBeenCalledWith("-password");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
