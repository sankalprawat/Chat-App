const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

const USER_CACHE_TTL_MS = 60_000;
const TOKEN_CACHE_TTL_MS = 60_000;
const PROFILE_SUMMARY_TTL_MS = 60_000;
const CONTACTS_CACHE_TTL_MS = 5_000;
const DIRECTORY_CACHE_TTL_MS = 15_000;
const MAX_CACHE_ENTRIES = 5_000;
const MAX_CONTACTS_ENTRIES = 2_000;

const userCache = new Map();
const tokenCache = new Map();
const profileSummaryCache = new Map();
const contactsCache = new Map();

let directorySlice = null;
let directoryExpiresAt = 0;

let cachedRawSecret = null;
let cachedSecretKey = null;

/**
 * Returns a memoized KeyObject for JWT HMAC operations outside unit tests.
 */
function getJwtKey() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "test" || typeof secret !== "string" || !secret) {
    return secret;
  }
  if (secret !== cachedRawSecret) {
    cachedRawSecret = secret;
    cachedSecretKey = crypto.createSecretKey(Buffer.from(secret, "utf8"));
  }
  return cachedSecretKey;
}

function setBounded(map, key, value, maxEntries = MAX_CACHE_ENTRIES) {
  if (map.size >= maxEntries && !map.has(key)) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) {
      map.delete(oldestKey);
    }
  }
  map.set(key, value);
}

/**
 * Verifies a Bearer JWT and resolves its non-password User document with bounded TTL caching.
 */
async function authenticateJwtToken(token) {
  if (process.env.NODE_ENV === "test") {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password").lean();
    return user || null;
  }

  const now = Date.now();
  const cachedToken = tokenCache.get(token);
  if (
    cachedToken &&
    now < cachedToken.expiresAt &&
    (!cachedToken.jwtExpMs || now < cachedToken.jwtExpMs)
  ) {
    const cachedUser = userCache.get(cachedToken.userId);
    if (cachedUser && now < cachedUser.expiresAt) {
      return cachedUser.user;
    }
  }

  const decoded = jwt.verify(token, getJwtKey());
  const userId = String(decoded.userId);
  const jwtExpMs = typeof decoded.exp === "number" ? decoded.exp * 1000 : 0;

  let cachedUser = userCache.get(userId);
  let user = cachedUser && now < cachedUser.expiresAt ? cachedUser.user : undefined;

  if (user === undefined) {
    user = await User.findById(decoded.userId).select("-password").lean();
    if (!user) {
      userCache.delete(userId);
      return null;
    }
    setBounded(userCache, userId, {
      user,
      expiresAt: now + USER_CACHE_TTL_MS,
    });
  }

  setBounded(tokenCache, token, {
    userId,
    jwtExpMs,
    expiresAt: now + TOKEN_CACHE_TTL_MS,
  });

  return user;
}

/**
 * Batch-resolves lightweight user profiles (fullName, email, profilePic) via cache + single raw $in lookup.
 */
async function resolveUserProfiles(ids) {
  const now = Date.now();
  const result = new Map();
  const missingIds = [];

  for (const rawId of ids) {
    if (!rawId) continue;
    const idStr = rawId.toString();
    if (result.has(idStr)) continue;
    const cached = profileSummaryCache.get(idStr);
    if (cached && now < cached.expiresAt) {
      result.set(idStr, cached.profile);
    } else {
      missingIds.push(idStr);
      result.set(idStr, null);
    }
  }

  if (missingIds.length > 0) {
    const objectIds = missingIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (objectIds.length > 0) {
      const docs = await User.collection
        .find(
          { _id: { $in: objectIds } },
          { projection: { fullName: 1, email: 1, profilePic: 1 } }
        )
        .toArray();
      const exp = now + PROFILE_SUMMARY_TTL_MS;
      for (const doc of docs) {
        const key = doc._id.toString();
        setBounded(profileSummaryCache, key, { profile: doc, expiresAt: exp });
        result.set(key, doc);
      }
    }
  }

  return result;
}

async function getCachedDirectoryTop(loaderFn) {
  const now = Date.now();
  if (directorySlice && now < directoryExpiresAt) {
    return directorySlice;
  }
  const rows = await loaderFn();
  directorySlice = rows;
  directoryExpiresAt = now + DIRECTORY_CACHE_TTL_MS;
  return rows;
}

function getCachedContactsPage(userId, page, limit) {
  if (process.env.NODE_ENV === "test") return null;
  const key = `${userId}:${page}:${limit}`;
  const entry = contactsCache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data;
  }
  return null;
}

function setCachedContactsPage(userId, page, limit, data) {
  if (process.env.NODE_ENV === "test") return;
  setBounded(
    contactsCache,
    `${userId}:${page}:${limit}`,
    { data, expiresAt: Date.now() + CONTACTS_CACHE_TTL_MS },
    MAX_CONTACTS_ENTRIES
  );
}

function invalidateContactsForUsers(...userIds) {
  if (contactsCache.size === 0) return;
  const targets = new Set(userIds.filter(Boolean).map(String));
  for (const key of contactsCache.keys()) {
    const uid = key.split(":")[0];
    if (targets.has(uid)) {
      contactsCache.delete(key);
    }
  }
}

function invalidateDirectoryCache() {
  directorySlice = null;
  directoryExpiresAt = 0;
  contactsCache.clear();
}

/**
 * Invalidates cached auth/profile/directory entries after profile updates.
 */
function invalidateUserCache(userId) {
  if (!userId) return;
  const idStr = String(userId);
  userCache.delete(idStr);
  profileSummaryCache.delete(idStr);
  directorySlice = null;
  directoryExpiresAt = 0;
  invalidateContactsForUsers(idStr);
}

function clearAuthCache() {
  userCache.clear();
  tokenCache.clear();
  profileSummaryCache.clear();
  contactsCache.clear();
  directorySlice = null;
  directoryExpiresAt = 0;
}

module.exports = {
  getJwtKey,
  authenticateJwtToken,
  resolveUserProfiles,
  getCachedDirectoryTop,
  getCachedContactsPage,
  setCachedContactsPage,
  invalidateContactsForUsers,
  invalidateDirectoryCache,
  invalidateUserCache,
  clearAuthCache,
};
