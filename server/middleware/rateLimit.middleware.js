/**
 * Lightweight fixed-window in-memory rate limiter middleware.
 */
function createRateLimiter({ windowMs = 60_000, max = 30, message = "Too many requests, please try again later." } = {}) {
  const hits = new Map();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (now >= entry.resetAt) {
        hits.delete(key);
      }
    }
  }, windowMs);

  // Do not keep the Node process alive solely for cleanup (important for tests)
  if (typeof cleanupInterval.unref === "function") {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const existing = hits.get(key);

    if (!existing || now >= existing.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (existing.count >= max) {
      const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfterSec, 1)));
      return res.status(429).json({ message });
    }

    existing.count += 1;
    return next();
  };
}

module.exports = { createRateLimiter };
