# Phase 1: Architecture Analysis & Pre-Test Performance Predictions

> **Locked before testing:** This document was written strictly from static code inspection prior to running any load tests, benchmarks, or runtime profilers. Numbers below will not be modified after Phase 2 begins.

---

## 1. System Architecture Map

### 1.1 High-Level Request & Event Topology

```
                          ┌────────────────────────────┐
                          │   React 19 + Vite Client   │
                          │  (SWR cache, Virtuoso,     │
                          │   Socket.IO client v4.8.3) │
                          └─────────────┬──────────────┘
                                        │ HTTP/1.1 + WebSocket (no proxy/CDN locally)
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                  Single-Process Node.js Server (server/index.js)              │
│  Express 5.2.1 + http.createServer + Socket.IO 4.8.3                          │
│  Middleware: express.json(1mb) -> cors -> routers -> global error handler     │
│                                                                               │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌─────────────────────┐  │
│  │ Auth Routes          │  │ Message Routes       │  │ Group Routes        │  │
│  │ /api/signup          │  │ /api/users/:id       │  │ /api/groups/create  │  │
│  │ /api/login           │  │ /api/send-message/:id│  │ /api/groups         │  │
│  │ /api/googleLogin     │  │ /api/get-message/:id │  │ /api/groups/:id/send│  │
│  │ /api/getProfile      │  └──────────┬───────────┘  │ /api/groups/:id/    │  │
│  │ /api/updateProfile   │             │              │   messages          │  │
│  │ /api/getAllContacts  │             │              └──────────┬──────────┘  │
│  └──────────┬───────────┘             │                         │             │
│             │                         ▼                         ▼             │
│             │              verifyToken (JWT + User.findById)                  │
│             │              multer diskStorage (uploads/) -> Cloudinary        │
│             ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ Socket.IO Service (server/services/socket.js)                           │  │
│  │ - socketAuth middleware (JWT + User.findById)                           │  │
│  │ - Joins user personal room + all Group._id rooms                        │  │
│  │ - In-memory userSocketMap: { [userId]: Set<socketId> }                  │  │
│  │ - Broadcasts full Object.keys(userSocketMap) on connect/disconnect       │  │
│  └───────────────────────────────────────┬─────────────────────────────────┘  │
└──────────────────────────────────────────┼────────────────────────────────────┘
                                           │ Mongoose 9.6.2 (default maxPoolSize=100)
                                           ▼
                          ┌────────────────────────────┐
                          │   MongoDB 8.3 (localhost)  │
                          │   Collections:             │
                          │   - users                  │
                          │   - messages               │
                          │   - groups                 │
                          │   - groupmessages          │
                          └────────────────────────────┘

External SaaS Dependencies (excluded from local load floods):
  - Google Firebase x509 Certs (https://www.googleapis.com/.../x509/securetoken...)
  - Cloudinary Upload API (res.cloudinary / uploader.upload & upload_large)
```

### 1.2 Component Inventory

| Layer | File | Responsibility & Notes |
|---|---|---|
| **Server Entry** | [server/index.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/index.js) | Single-process Express 5 + `http.createServer` + Socket.IO; `express.json({ limit: "1mb" })`; no `compression`, no `trust proxy`, no clustering. |
| **Database Config** | [server/config/db.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/config/db.js) | `mongoose.connect(process.env.MONGO_URI)` using default driver pool (`maxPoolSize: 100`, `minPoolSize: 0`), no `maxTimeMS` query timeout. |
| **Auth Middleware** | [verifyToken.middleware.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/verifyToken.middleware.js) | `jwt.verify` + **DB query (`User.findById().select("-password").lean()`) on every authenticated HTTP request**. |
| **Socket Auth** | [socket.auth.middleware.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/socket.auth.middleware.js) | `jwt.verify` + DB query (`User.findById().select("-password").lean()`) on every socket handshake. |
| **Rate Limiter** | [rateLimit.middleware.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/rateLimit.middleware.js) | Fixed-window in-memory `Map` keyed by `req.ip`; applied only to `/signup`, `/login`, `/googleLogin` (`max: 30` per `15 min`). `setInterval(...).unref()` cleanup timer. |
| **Upload Pipeline** | [multer.middleware.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/multer.middleware.js), [cloudinary.middleware.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/cloudinary.middleware.js) | Writes up to 10 files x 100 MB to `server/uploads/` disk, then `Promise.allSettled` uploads concurrently to Cloudinary before `fs.unlink`. |
| **External Auth** | [firebaseAuth.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/services/firebaseAuth.js) | Fetches Google x509 certs and caches in memory using `Cache-Control: max-age`; no in-flight request deduplication (`singleflight`) and no `fetch` timeout. |
| **Socket Service** | [socket.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/services/socket.js) | Single-node in-memory `userSocketMap`; queries `Group.find({ members: userId })` on every connect; broadcasts entire online-user ID list globally on state transitions. |
| **Caching** | Frontend `useSWR` only | **Zero server-side caching** (no Redis, no in-memory LRU for user auth or contacts). |
| **Background Jobs** | None | Only the `.unref()` rate-limit `Map` sweep interval; no job queue or worker process. |

### 1.3 Data Models & Indexes

- **`User`** ([User.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/models/User.js)): Unique index on `email`. No index on `googleId` (currently queried by `email`).
- **`Message`** ([Message.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/models/Message.js)):
  - `{ senderId: 1, receiverId: 1, createdAt: -1 }`
  - `{ receiverId: 1, senderId: 1, createdAt: -1 }`
  - `{ senderId: 1, createdAt: -1 }`
  - `{ receiverId: 1, createdAt: -1 }`
- **`Group`** ([Group.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/models/Group.js)):
  - `{ members: 1, updatedAt: -1 }` (multikey compound index on array `members`).
- **`GroupMessage`** ([GroupMessage.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/models/GroupMessage.js)):
  - `{ groupId: 1, createdAt: -1 }`.

---

## 2. Identified Bottlenecks (Static Code Analysis)

### B1. Unbounded User Scan + Full History Aggregation + Main-Thread Sort in `GET /api/getAllContacts` (CRITICAL)
- **Location**: [auth.controller.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/controllers/auth.controller.js#L245-L298)
- **Mechanism**:
  1. Executes `Message.aggregate` matching all historical DMs involving `loginUserId` with `$group` over all matched documents (no `$sort` + `$limit`, no time bound).
  2. Executes `User.find({ _id: { $ne: loginUserId } }).select("-password").lean()` with **no `limit` and no pagination**, loading every user in the database into Node memory on every call.
  3. Sorts the entire array on Node's single event loop using `String.prototype.localeCompare()` (expensive `Intl` collation in $O(U \log U)$ calls).
  4. Serializes an uncompressed payload that grows linearly with total user count $U$ (~250–350 KB per request at $U = 1{,}000$; ~2.8 MB at $U = 10{,}000$).
- **Amplification**: [Contacts.tsx](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/components/Contacts.tsx#L90-L99) triggers `mutate()` (`GET /api/getAllContacts`) on **every single `newMessage` Socket.IO event**, tying heavy contact-list scans directly to live messaging throughput.

### B2. Event-Loop CPU Starvation from Pure-JS `bcryptjs` + Broken Proxy IP Keying in Auth Routes (CRITICAL)
- **Location**: [auth.controller.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/controllers/auth.controller.js#L60-L111), [auth.route.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/routes/auth.route.js#L17-L25), [rateLimit.middleware.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/rateLimit.middleware.js#L4-L40)
- **Mechanism**:
  1. Uses pure-JavaScript `bcryptjs` (cost factor 10 = $2^{10}$ rounds) instead of native C++ `bcrypt` or `argon2` on worker threads. Each `bcrypt.hash` / `bcrypt.compare` consumes ~45–80 ms of **single-thread Node event loop CPU**, capping maximum compute throughput at ~12–22 auth ops/s and causing cross-endpoint event loop lag spikes for all users during login bursts.
  2. `authLimiter` allows only `30` requests per `15 min` per `req.ip`. Because `app.set("trust proxy", ...)` is not configured in `server/index.js`, deploying behind any reverse proxy collapses all global users onto the proxy IP (locking out all users after 30 logins/signups globally). Additionally, the `hits` `Map` is bounded only by a 15-minute cleanup sweep (vulnerable to memory growth under spoofed-IP floods if proxy trust were enabled).

### B3. $O(N^2)$ Message / $O(N^3)$ Payload Socket.IO Presence Broadcast Storm & Single-Node State (HIGH)
- **Location**: [socket.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/services/socket.js#L14-L56)
- **Mechanism**:
  1. On every offline->online transition and every final socket disconnect, the server emits `io.emit("onlineUser", Object.keys(userSocketMap))` to **all** connected clients.
  2. During a concurrent connect wave or reconnect storm of $N$ users, the server sends $\frac{N(N+1)}{2}$ messages totaling $O(N^3)$ serialized bytes (e.g., 500 concurrent reconnects generate ~125k events and ~1.1 GB of JSON payload on the single Node process).
  3. `userSocketMap` is process-local (no Redis adapter), preventing horizontal scaling across multiple Node workers/instances.
  4. `socket.on("connection")` logs `console.log(...)` synchronously and executes 2 sequential DB queries (`User.findById` in `socketAuth` + `Group.find({ members: userId })`).

### B4. Multikey Index Churn & Document Lock Contention on `Group.updatedAt` + Client Fan-Out Storm (HIGH)
- **Location**: [group.controller.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/controllers/group.controller.js#L81-L145), [Group.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/models/Group.js#L35), [GroupTab.tsx](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/components/GroupTab.tsx#L44-L54)
- **Mechanism**:
  1. `Group` defines a multikey compound index `{ members: 1, updatedAt: -1 }`. For a group with $M$ members, MongoDB maintains $M$ index keys pointing to that single `Group` document.
  2. Every `POST /api/groups/:groupId/send` executes `Group.findByIdAndUpdate(groupId, { updatedAt: new Date() })`, forcing a document write lock on the single `Group` doc and deleting/reinserting $M$ multikey index entries per message.
  3. On the client, [GroupTab.tsx](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/components/GroupTab.tsx#L44-L54) triggers `fetchGroups()` (`GET /api/groups`) on every `newGroupMessage` socket event. One message to an $M$-member group causes up to $M$ simultaneous `GET /api/groups` calls—each running an unbounded `Group.find({ members: userId }).populate("admin", ...).populate("members", ...)` (3 DB queries + full member object duplication).

### B5. Per-Request Redundant DB Roundtrips & Sort/Index Mismatch on Message Queries (HIGH)
- **Location**: [verifyToken.middleware.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/verifyToken.middleware.js#L16-L26), [message.controller.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/controllers/message.controller.js#L51-L138), [group.controller.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/controllers/group.controller.js#L158-L224)
- **Mechanism**:
  1. `verifyToken` queries `User.findById(decoded.userId)` on **every** authenticated request even when handlers only need `req.user._id`.
  2. Sequential query waterfalls: `sendMessage` executes 3 sequential awaits (`User.findById` -> `User.exists` -> `Message.create` updating 5 indexes); `sendGroupMessage` executes 4 sequential DB stages (`User.findById` -> `Group.exists` -> `GroupMessage.create` -> `populate` + `Group.findByIdAndUpdate`); `getGroupMessages` (`page=1`) executes 5 DB queries (`User.findById`, `Group.findOne` + `populate("members")`, `GroupMessage.find` + `populate("senderId")`).
  3. Both `getMessage` and `getGroupMessages` sort by `{ createdAt: -1, _id: -1 }`, while their indexes omit `_id: -1` (`{ senderId: 1, receiverId: 1, createdAt: -1 }` and `{ groupId: 1, createdAt: -1 }`). For `page > 1`, `.skip((page - 1) * limit)` incurs $O(\text{skip} + \text{limit})$ scan cost, and `$or` + compound tie-breaker `_id: -1` risks extra sort/merge work in MongoDB.

### B6. Blocking Disk-Buffered Media Uploads & Unbounded External Calls (MEDIUM-HIGH)
- **Location**: [multer.middleware.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/multer.middleware.js#L35-L39), [cloudinary.middleware.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/cloudinary.middleware.js#L43-L66), [firebaseAuth.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/services/firebaseAuth.js#L12-L30)
- **Mechanism**:
  1. Multer allows `10 files x 100 MB` = **1 GB per request** buffered to `server/uploads/` disk, followed by `Promise.allSettled` uploading all 10 files concurrently to Cloudinary with no timeout or backpressure/queue. Concurrent media uploads can exhaust disk space, file descriptors, and outbound sockets.
  2. `getFirebasePublicCerts` performs un-deduplicated `fetch()` with no timeout when certs are missing/expired (cache-stampede risk on cold start or key rotation).

### B7. Operational & Serialization Gaps (MEDIUM)
- **Location**: [server/index.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/index.js#L16-L31), [server/config/db.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/config/db.js#L5-L13)
- **Mechanism**:
  1. No `compression` middleware (large JSON payloads from `/api/getAllContacts` and `/api/groups` sent raw).
  2. No Mongoose `maxTimeMS` query timeouts; slow queries hold connection pool slots (`maxPoolSize: 100`) and event loop closures indefinitely.
  3. `/api/health` only checks `mongoose.connection.readyState === 1` in memory without testing DB responsiveness.

---

## 3. Environment Assumptions & Baseline Dataset Model

All Phase 1 capacity estimates are anchored to the **local test machine** and an explicit seeded dataset so Phase 2 tests can compare apples-to-apples:

- **Host Hardware (measured via Node `os`)**:
  - CPU: AMD Ryzen 5 5600H (6 physical cores / 12 logical threads). Single Node.js v24.6.0 process is constrained to **1 JS event-loop thread**; `mongod` 8.3 and load generator share the remaining cores on the same host (introducing ~15–25% co-hosting CPU contention at saturation).
  - Memory: **7.36 GB total physical RAM** (~1.30 GB free at rest -> practical headroom for server + MongoDB + load tool before paging is ~1.2–1.8 GB).
  - Network: Windows loopback (`127.0.0.1`), ~0.1–0.3 ms RTT, HTTP keep-alive enabled unless testing connection churn.
- **Seeded Dataset Assumptions (for Medium-Scale Load Model)**:
  - **1,000 Users** (each user record ~300 B).
  - **50,000 Direct Messages** (~50 DMs per active pair; test user has ~100–500 messages across contacts).
  - **50 Groups**, **20 Members per group**, **25,000 Group Messages** (500 messages/group).
- **Database & Server Config**:
  - Single Node process (`NODE_ENV` default), local MongoDB 8.3 (`mongodb://localhost:27017/chatApp_loadtest`), Mongoose default `maxPoolSize: 100`, no Redis, no external Cloudinary/Firebase flooding.

---

## 4. Predicted Maximum Sustainable Load (Key Endpoints)

> **Definition of "Maximum Sustainable Load"**: Highest steady throughput (req/s) and concurrent active virtual users (VUs) where error rate stays `< 1%` (excluding intentional rate-limit tests) and `p95` latency stays `< 200 ms` (or `< 500 ms` for heavy aggregate/auth endpoints) without unbounded queue/memory growth.

| Endpoint / Flow | Primary Bottleneck | Est. CPU + DB Time / Req (Unloaded) | Predicted Max Sustainable Throughput | Predicted Max Concurrent Active VUs | Predicted Breaking Point & Failure Mode |
|---|---|---|---:|---:|---|
| `GET /api/health` | Express 5 routing + loopback TCP/OS scheduling | ~0.08–0.15 ms | **6,000 – 10,000 req/s** | **150 – 250 VUs** (continuous tight loop) | ~11,000+ req/s; event-loop saturation & Windows loopback/load-gen CPU contention drive p99 > 100 ms. |
| `POST /api/login` *(with `authLimiter`)* | Fixed-window IP limiter (`max: 30 / 15m`, no `trust proxy`) | ~50–80 ms | **0.033 req/s** (30 req / 15m per IP) | **1 VU** bursts 30, then 100% HTTP 429 | Request #31 from same IP fails with HTTP `429 Too Many Requests`. |
| `POST /api/login` *(compute ceiling, unique IPs / limiter bypassed)* | Pure-JS `bcryptjs` cost-10 on single Node JS thread | ~50–80 ms JS CPU | **12 – 20 req/s** | **15 – 25 VUs** | >25 req/s saturates 100% of Node main thread; p95 spikes > 1,500 ms and stalls *all* other routes on the server. |
| `GET /api/getAllContacts` *(at $U=1{,}000$ users)* | Unbounded `User.find` (999 docs) + `Message.aggregate` + JS `localeCompare` sort + ~300 KB JSON | ~15–28 ms JS CPU + DB | **35 – 65 req/s** | **25 – 50 VUs** | >80–110 req/s saturates Node main thread & V8 GC (allocating/sorting 1k objects/req); p95 > 500–2,000 ms. *(At $U=10{,}000$: drops to **3–6 req/s**).* |
| `GET /api/get-message/:userId` *(page=1, limit=50)* | Per-req `verifyToken` DB hit + `$or` index scan/sort + Mongoose lean hydration (~12 KB) | ~2–5 ms | **300 – 550 req/s** | **100 – 180 VUs** | >600 req/s saturates Node JS BSON/Express thread & MongoDB query concurrency; deep `page` (`skip`) collapses throughput below 100 req/s. |
| `POST /api/send-message/:receiverId` *(text-only)* | 3 sequential DB awaits + 5 index writes on `Message` + Mongoose doc creation + Socket emit | ~4–9 ms (2–4 ms Node CPU) | **150 – 280 req/s** | **50 – 110 VUs** | >320 req/s causes Mongoose CPU + MongoDB write/index lock queueing; p95 exceeds 300–500 ms. |
| `GET /api/groups` *(10 groups x 20 members)* | `verifyToken` DB hit + 2x `.populate()` (3 queries) + ~60 KB JSON serialization | ~6–12 ms | **110 – 200 req/s** | **40 – 80 VUs** | >230 req/s saturates Mongoose populate hydration & JSON serialization; exacerbated by client `newGroupMessage` fan-out storm. |
| `POST /api/groups/:groupId/send` *(mixed groups)* | 4 sequential DB stages + `Group` single-doc lock & 20-key multikey index churn + room emit | ~6–14 ms | **90 – 160 req/s** | **35 – 75 VUs** | **Hot single group**: ~45–85 req/s due to `Group.updatedAt` document write-lock & multikey index contention; **client fan-out**: $M=20$ online users multiplying into `GET /api/groups` breaks at ~10 msg/s! |
| `GET /api/groups/:groupId/messages` *(initial `page=1`)* | 5 DB queries/req (`verifyToken`, `Group.findOne` + `populate`, `GroupMessage.find` + `populate`) | ~5–10 ms | **130 – 220 req/s** | **50 – 90 VUs** | >250 req/s hits Node Mongoose hydration CPU + MongoDB connection pool contention. |
| **Socket.IO Connect Storm** | `socketAuth` + `Group.find` + $O(N^2)$ `onlineUser` broadcasts ($O(N^3)$ bytes) | ~3–6 ms + growing broadcast | **60 – 120 connects/s** (under low $N$); collapses as $N > 400$ | **300 – 500 concurrent reconnects** (burst); **1,500–3,000 idle** | Connect burst > 400–500 users triggers massive `onlineUser` JSON broadcast storm, spiking event-loop lag > 5 s and causing Engine.IO `pingTimeout` disconnects. |

### Reasoning Summary

1. **Single-threaded Node event loop is the dominant ceiling**, not MongoDB raw I/O. Anything CPU-heavy on the JS thread (`bcryptjs`, sorting 1,000 contacts with `localeCompare`, Mongoose document instantiation + `.populate()` hydration, serializing 300 KB JSON or $O(N^2)$ `onlineUser` arrays) directly throttles every concurrent endpoint sharing the process.
2. **Co-hosting penalty**: Because Node, MongoDB 8.3, and the load generator run on the same 6-core / 7.36 GB Windows laptop, high-throughput runs (`health`, `get-message`, `send-message`) will experience ~15–25% lower throughput than a dedicated multi-host server, and memory pressure (~1.3 GB free RAM) caps concurrent Socket.IO + MongoDB buffers early if payloads bloat.
3. **Worst-case realistic user-flow bottleneck**: A real user flow combining login (`bcryptjs`), sidebar load (`getAllContacts` + `groups`), active chatting (`sendMessage` + `sendGroupMessage`), and client-triggered revalidation (`newMessage -> getAllContacts`, `newGroupMessage -> getUserGroups`) will fail first on:
   - **IP-wide auth rate limit** (if behind a proxy) or **login CPU starvation** (`bcryptjs`),
   - **`getAllContacts` payload/CPU explosion** as user count grows and every DM triggers revalidation,
   - **Group chat amplification** (`sendGroupMessage` -> `Group.updatedAt` multikey churn + $M\times$ `GET /api/groups` fan-out), and
   - **Socket.IO reconnect storms** (`onlineUser` full-list broadcasts).
