const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const {
  authenticateJwtToken,
  invalidateUserCache,
  clearAuthCache,
  getJwtKey,
} = require("../authCache");
const { PasswordWorkerPool } = require("../passwordHasher");

describe("authCache and PasswordWorkerPool", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.JWT_SECRET = originalSecret;
    clearAuthCache();
    jest.restoreAllMocks();
  });

  it("caches verified JWT token + user lookup and invalidates via invalidateUserCache", async () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "super-secret-jwt-test-key-32-chars!!";
    clearAuthCache();

    const token = jwt.sign({ userId: "u-cache-1" }, getJwtKey(), { expiresIn: "1h" });
    const mockUser = { _id: "u-cache-1", fullName: "Cached User" };
    const leanMock = jest.fn().mockResolvedValue(mockUser);
    const selectMock = jest.fn().mockReturnValue({ lean: leanMock });
    const findByIdSpy = jest.spyOn(User, "findById").mockReturnValue({ select: selectMock });

    const first = await authenticateJwtToken(token);
    const second = await authenticateJwtToken(token);

    expect(first).toEqual(mockUser);
    expect(second).toEqual(mockUser);
    expect(findByIdSpy).toHaveBeenCalledTimes(1);

    invalidateUserCache("u-cache-1");
    await authenticateJwtToken(token);
    expect(findByIdSpy).toHaveBeenCalledTimes(2);
  });

  it("hashes and verifies passwords inside worker_threads pool", async () => {
    const pool = new PasswordWorkerPool(2);
    try {
      const hash = await pool.run("hash", ["secret-password-123", 4]);
      expect(typeof hash).toBe("string");
      expect(hash.startsWith("$2")).toBe(true);

      const valid = await pool.run("compare", ["secret-password-123", hash]);
      const invalid = await pool.run("compare", ["wrong-password", hash]);
      expect(valid).toBe(true);
      expect(invalid).toBe(false);
    } finally {
      await pool.destroy();
    }
  });
});
