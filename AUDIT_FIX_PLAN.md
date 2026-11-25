# Codebase Audit & Step-by-Step Fix Plan

This document tracks every security vulnerability, functional bug, and performance/optimization issue identified during the codebase audit, organized into sequential implementation phases.

---

## Phase 1: Security & Authentication Hardening
- [x] **Verify Google OAuth / Firebase ID tokens server-side** (`server/services/firebaseAuth.js`, `server/controllers/auth.controller.js`, `client/src/pages/Login.tsx`, `client/src/pages/SignUp.tsx`)
  - Send Firebase `idToken` (`await googleUser.getIdToken()`) instead of trusting client-supplied `email`/`googleId`.
  - Verify the RS256 Firebase JWT server-side against Google's public x509 certificates (`iss`, `aud`, `exp`, `email_verified`) using `FIREBASE_PROJECT_ID`.
  - Prevent overwriting existing user `fullName`/`profilePic` on returning Google login, and reject `googleId` mismatches with `403`.
  - *(Note: Ensure `FIREBASE_PROJECT_ID` is set in `server/.env` matching `VITE_FIREBASE_PROJECT_ID`.)*
- [x] **Prevent password hash leakage** (`server/models/User.js`, `server/controllers/auth.controller.js`)
  - Set `select: false` on `User.password` and strip `password` in `toJSON` / `toObject` transforms.
  - Explicitly `.select("+password")` only during credential verification in `login`.
  - Add `.select("-password")` to `updateProfile` and sanitize `signUp`/`googleLogin` responses.
- [x] **Fix bypassed password length, input validation & add auth rate limiting** (`server/controllers/auth.controller.js`, `server/middleware/rateLimit.middleware.js`, `server/routes/auth.route.js`)
  - Validate string types, email format, and `password.length >= 6` *before* `bcrypt.hash` in `signUp`.
  - Add string validation, email validation, and `{ runValidators: true }` in `updateProfile`.
  - Add fixed-window rate limiter on `/signup`, `/login`, and `/googleLogin`.
- [x] **Fix `verifyToken` middleware semantics** (`server/middleware/verifyToken.middleware.js`)
  - Enforce `Bearer <token>` prefix explicitly.
  - Return `401` (instead of `400`) when the token's user does not exist so the client 401 interceptor triggers logout cleanly.
  - Use `.lean()` on the user lookup.
- [x] **Client Auth UX & Asset Fixes** (`client/src/pages/Login.tsx`, `client/src/pages/SignUp.tsx`, `client/src/components/GoogleIcon.tsx`)
  - Remove artificial `800ms` `setTimeout` delays on login and signup.
  - Guard `if (token)` and double-click `googleLoading` state in `SignUp.tsx` & `Login.tsx`.
  - Fix distorted chat bubble SVG path (`c5.523 20` -> `c5.523 0`) in `Login.tsx` and replace external `google.com/favicon.ico` with a shared inline `GoogleIcon` component.

---

## Phase 2: Server Stability, Uploads & Database Performance
- [x] **Fail fast on DB connection failure & harden Express server** (`server/config/db.js`, `server/index.js`)
  - Rethrow connection errors in `dbConnect()` so `server/index.js` exits on startup failure.
  - Configure CORS using `process.env.CLIENT_URL` (with `*` fallback when unset), set JSON body limit (`1mb`), and add global Express JSON error-handling middleware (handling `MulterError` and custom status errors).
- [x] **Add missing MongoDB compound indexes & lean queries** (`server/models/Message.js`, `server/models/GroupMessage.js`, `server/models/Group.js`)
  - `Message`: add `{ senderId: 1, receiverId: 1, createdAt: -1 }`, `{ receiverId: 1, senderId: 1, createdAt: -1 }`, `{ senderId: 1, createdAt: -1 }`, and `{ receiverId: 1, createdAt: -1 }`.
  - `GroupMessage`: replace single-field index with `{ groupId: 1, createdAt: -1 }`.
  - `Group`: add `{ members: 1, updatedAt: -1 }`.
  - Use `.lean()` on read-only queries (`getMessage`, `getGroupMessages`, `getUserGroups`, `getUserById`, `socketAuth`) and `User.exists()` in `sendMessage`.
- [x] **Optimize & harden file uploads** (`server/middleware/multer.middleware.js`, `server/middleware/cloudinary.middleware.js`)
  - Sanitize filenames with random UUID suffixes to avoid same-millisecond collisions.
  - Add `fileFilter` allowing only `image/*`, `video/*`, and `audio/*` so unsupported files fail fast with `400`.
  - Upload multiple files concurrently with `Promise.allSettled`, clean up temp files asynchronously with `fs/promises.unlink`, and clean up partial Cloudinary uploads (`destroy`) if any file in the batch fails.
- [x] **Fix controller validation, pagination, and group activity** (`server/controllers/auth.controller.js`, `server/controllers/message.controller.js`, `server/controllers/group.controller.js`)
  - Validate `mongoose.isValidObjectId(...)` on params and member arrays (`400` instead of `500`).
  - Reject empty messages (must have non-empty `text.trim()` or uploaded media) in `sendMessage` and `sendGroupMessage`.
  - Guard `if (Array.isArray(req.imageUrl) && req.imageUrl.length > 0)` in `updateProfile`.
  - Reuse `req.user` in `getProfile` instead of a redundant `User.findById` call.
  - Support cursor-based pagination (`before` + `beforeId`) alongside `page` in `getMessage` and `getGroupMessages`.
  - In `createGroup`: populate `admin`/`members` in response and emit `"groupCreated"` to member rooms.
  - In `sendGroupMessage`: update `Group.updatedAt` so `getUserGroups` sorts by latest message activity.
  - In `getGroupMessages`: only return populated `group` details on initial fetch (`page === 1 && !before`).
  - Remove dead `/api/imageupload` route and handler.
- [x] **Optimize Socket.IO connection & broadcast logic** (`server/services/socket.js`, `server/middleware/socket.auth.middleware.js`)
  - Only broadcast `"onlineUser"` when a user's first socket connects or last socket disconnects (emit snapshot only to the new socket on multi-tab connections).
  - Use `.lean()` in `socketAuth` and align CORS config.

---

## Phase 3: Real-Time Messaging, Socket Context & MessageArea Fixes
- [x] **Harden `SocketContext` lifecycle** (`client/src/context/SocketContext.tsx`)
  - Memoize `login`, `logout`, and context value.
  - Expose reactive `socket` state alongside `socketRef` so child listeners always attach reliably.
  - Handle `disconnect` (`setSocketConnected(false)`) and auth `connect_error` (trigger `logout()` on invalid/expired JWT).
- [x] **Fix `MessageArea` bugs & virtualize messages** (`client/src/components/chat/MessageArea.tsx`, `client/src/pages/Group.tsx`)
  - Filter incoming `newMessage` and `newGroupMessage` events strictly by active `userId` / `groupId`.
  - Fix chat-switch race condition using `AbortController` and inline initial fetch.
  - Reset `groupInfo` in `Group.tsx` when switching groups and update `document.title`.
  - Virtualize messages with `react-virtuoso` (`Virtuoso`) + `firstItemIndex` and cursor-based pagination (`before`/`beforeId`).
  - Add `preload="metadata"` + `#t=0.1` on video thumbnails and `loading="lazy"` on images.

---

## Phase 4: InputBar, Sidebar, Modals, Settings & Profile
- [x] **Fix `InputBar` memory leaks, UX, and bundle bloat** (`client/src/components/chat/InputBar.tsx`)
  - Fix `useEffect` object URL cleanup (revoke only on unmount via ref, individual remove, or send).
  - Clear `fileInputRef.current.value` in `onChange`, add `accept="image/*,video/*,audio/*"`, validate supported file types client-side, and check `!e.nativeEvent.isComposing` on Enter.
  - Lazy-load `EmojiPicker` (`React.lazy` + `Suspense` + type-only `Theme` import) and mount only when `showEmojiPicker` is open (~307 kB split out of `MessageArea`).
  - Wire up the microphone button with `MediaRecorder` voice note recording and clean stream teardown.
  - Fix invalid Tailwind classes (`red-650`, `zinc-450`).
- [x] **Fix `Contacts` & `GroupTab` caching, styling, and live sorting** (`client/src/components/Contacts.tsx`, `client/src/components/GroupTab.tsx`)
  - Key `useSWR` by `[url, token]` to prevent stale user data across account switches.
  - Fix light-mode active contact contrast (`text-[#007aff] dark:text-white`).
  - Use a memoized `Set<string>` for `O(1)` online status checks, add `min-h-0` to Virtuoso wrapper, and render SWR error/retry states.
  - Revalidate/update sidebar order on `newMessage`, `newGroupMessage`, and `groupCreated` socket events.
- [x] **Optimize `CreateGroupModal`, `Settings`, and `Profile`** (`client/src/components/CreateGroupModal.tsx`, `client/src/pages/Settings.tsx`, `client/src/pages/Profile.tsx`)
  - Reuse SWR cache in `CreateGroupModal`, replace `alert()` with `toast.error()`, remove manual `multipart/form-data` header, and fix invalid Tailwind classes (`zinc-550`, `zinc-750`).
  - Eliminate triple `/api/getProfile` fetches between `Settings` and `Profile` and prevent `Settings` from unmounting `Profile` on save.
  - Fix `Profile.tsx` object URL leak (`URL.revokeObjectURL`), use `useSocket()` token/setUser, fix Settings Back navigation fallback, and replace invalid Tailwind shades (`zinc-450`, `zinc-550`, `zinc-650`).

---

## Phase 5: Routing, Layout, Cleanup & Tooling
- [x] **Route code-splitting & layout cleanup** (`client/src/App.tsx`, `client/src/layouts/MainLayout.tsx`, `client/src/components/MediaModal.tsx`, `client/src/components/chat/ChatHeader.tsx`, `client/index.html`, `client/src/main.tsx`)
  - Add route-level `React.lazy` + `Suspense` in `App.tsx`, add `PublicRoute` redirect for `/login` and `/signup`, and redirect unauthenticated users to `/login`.
  - Clean unused imports/variables across `MainLayout.tsx`, `Group.tsx`, `Settings.tsx`, `ChatHeader.tsx`, and clear copy timer on unmount in `MainLayout.tsx`.
  - Fix invalid Tailwind shades (`zinc-850`, `zinc-650`, `zinc-350`), add `text-white` to audio modal icon in `MediaModal.tsx`, and update `client/index.html` `<title>`.
  - Fix `ChatHeader.tsx` SWR key `[url, token]`.
- [ ] **Optional Dependency Cleanup (requires `npm install` when online):**
  - Remove unused `react-hot-toast` from `client/package.json` + `client/package-lock.json`.
  - Install `typescript-eslint` and update `client/eslint.config.js` to lint `**/*.{ts,tsx}`.

---

## Phase 6: Automated Tests & Final Verification
- [x] **Update & expand server Jest tests** (`server/middleware/__tests__/verifyToken.test.js`, `server/middleware/__tests__/cloudinary.middleware.test.js`, `server/controllers/__tests__/auth.controller.test.js`, `server/controllers/__tests__/messageAndGroup.controller.test.js`)
- [x] **Add client Vitest unit/component tests** (`client/src/components/__tests__/MessageArea.test.tsx`, `client/src/components/__tests__/InputBar.test.tsx`, `client/src/components/__tests__/Contacts.test.tsx`)
- [x] **Run full verification suite** (`server` `npm test`, `client` `npm run type-check`, `npm test`, `npm run build`)
