const jwt = require("jsonwebtoken");

const FIREBASE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts = null;
let cacheExpiresAt = 0;

/**
 * Fetches and caches Google's public x509 certificates for Firebase ID token verification.
 */
async function getFirebasePublicCerts(forceRefresh = false) {
  if (!forceRefresh && cachedCerts && Date.now() < cacheExpiresAt) {
    return cachedCerts;
  }

  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Firebase public keys (${response.status})`);
  }

  const certs = await response.json();
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  cachedCerts = certs;
  cacheExpiresAt = Date.now() + maxAgeSeconds * 1000;
  return certs;
}

/**
 * Verifies a Firebase Auth ID token against Google's RS256 public keys and the configured project ID.
 */
async function verifyFirebaseIdToken(idToken) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    const err = new Error("Google authentication is not configured on the server");
    err.statusCode = 500;
    throw err;
  }

  if (typeof idToken !== "string" || !idToken.trim()) {
    const err = new Error("Missing Google ID token");
    err.statusCode = 400;
    throw err;
  }

  const decodedComplete = jwt.decode(idToken, { complete: true });
  if (!decodedComplete || typeof decodedComplete !== "object") {
    const err = new Error("Invalid Google ID token");
    err.statusCode = 401;
    throw err;
  }

  const { header } = decodedComplete;
  if (!header || header.alg !== "RS256" || !header.kid) {
    const err = new Error("Invalid Google ID token header");
    err.statusCode = 401;
    throw err;
  }

  let certs = await getFirebasePublicCerts(false);
  if (!certs[header.kid]) {
    certs = await getFirebasePublicCerts(true);
  }

  const cert = certs[header.kid];
  if (!cert) {
    const err = new Error("Unrecognized Google signing key");
    err.statusCode = 401;
    throw err;
  }

  let payload;
  try {
    payload = jwt.verify(idToken, cert, {
      algorithms: ["RS256"],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    });
  } catch {
    const err = new Error("Invalid or expired Google ID token");
    err.statusCode = 401;
    throw err;
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    payload.sub.length > 128
  ) {
    const err = new Error("Invalid Google token subject");
    err.statusCode = 401;
    throw err;
  }

  if (typeof payload.email !== "string" || payload.email_verified !== true) {
    const err = new Error("Verified Google email is required");
    err.statusCode = 401;
    throw err;
  }

  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    fullName: typeof payload.name === "string" ? payload.name.trim() : "",
    profilePic: typeof payload.picture === "string" ? payload.picture : "",
  };
}

module.exports = { verifyFirebaseIdToken };
