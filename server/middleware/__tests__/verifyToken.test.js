const verifyToken = require("../verifyToken.middleware");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

// Mock the dependencies
jest.mock("jsonwebtoken");
jest.mock("../../models/User");

describe("verifyToken Middleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock Express req, res, and next
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    
    // Suppress console.log during tests to keep output clean
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  it("should return 401 Unauthorized if Authorization header is missing", async () => {
    // req.headers.authorization is undefined
    await verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 Unauthorized if Authorization header format is invalid", async () => {
    req.headers.authorization = "invalidformat";
    
    await verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 Unauthorized if token is invalid or expired", async () => {
    req.headers.authorization = "Bearer invalidtoken";
    jwt.verify.mockImplementation(() => {
      throw new Error("Invalid token");
    });

    await verifyToken(req, res, next);

    expect(jwt.verify).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 400 User not found if user does not exist in database", async () => {
    req.headers.authorization = "Bearer validtoken";
    jwt.verify.mockReturnValue({ userId: "mockUserId" });
    
    // User.findById.select returns null
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null)
    });

    await verifyToken(req, res, next);

    expect(jwt.verify).toHaveBeenCalled();
    expect(User.findById).toHaveBeenCalledWith("mockUserId");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next() and attach user to req if token is valid and user exists", async () => {
    req.headers.authorization = "Bearer validtoken";
    jwt.verify.mockReturnValue({ userId: "mockUserId" });
    
    const mockUser = { _id: "mockUserId", username: "testuser" };
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser)
    });

    await verifyToken(req, res, next);

    expect(jwt.verify).toHaveBeenCalled();
    expect(User.findById).toHaveBeenCalledWith("mockUserId");
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
