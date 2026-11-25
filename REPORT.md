# Performance Analysis & Stress Test Report

> **Scope:** Unmodified local execution of the Chatting App Express + Socket.IO server (`Node.js v24.6.0`) backed by an isolated local MongoDB `v8.3.1` database (`mongodb://127.0.0.1:27018/chatApp_loadtest`), seeded identically to the dataset modeled in [PREDICTIONS.md](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/PREDICTIONS.md) (`1,000` users, `50,000` DMs, `50` groups x `20` members, `25,000` group messages). External third-party APIs (`Cloudinary`, `Google Firebase x509`) were intentionally excluded from live traffic floods.

---

## 1. Test Methodology & Telemetry Instrumentation

| Layer | Tool / Script | Captured Metrics |
|---|---|---|
| **Load Generator** | `k6 v2.4.0` ([01_baseline.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/01_baseline.js), [02_ramp.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/02_ramp.js), [03_soak.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/03_soak.js), [04_spike.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/04_spike.js), [05_socketio_storm.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/05_socketio_storm.js), [06_health_vus.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/06_health_vus.js), [07_socketio_burst.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/07_socketio_burst.js)) | Throughput (`req/s`), `p50`/`p95`/`p99`/`max` latency, HTTP/WS errors, dropped iterations, 5-second bucketed time-series |
| **Node Runtime Profiler** | `--cpu-prof` + [monitor-preload.cjs](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/monitor-preload.cjs) | V8 self-time CPU profiles, `process.cpuUsage()` (% of 1 core), `rss`/`heapUsed`, `perf_hooks` event-loop lag (`p95`/`max`) |
| **OS Resource Monitor** | [ps-sampler.py](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/ps-sampler.py) (`psutil 7.0.0`) | `node.exe` & `mongod.exe` process CPU%, RSS MB, system CPU%, free physical RAM |
| **Database Telemetry** | [explain-queries.cjs](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/explain-queries.cjs) + `serverStatus` + `system.profile` (`slowms: 5`) | `connectionsCurrent`, `opcounters` (`insert`/`query`/`update`), WiredTiger cache MB, `writeConflicts`, `IXSCAN` vs `SORT` plans |

---

## 2. Phase 2 Stress Test Results

### 2.1 Baseline Run ([01_baseline.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/01_baseline.js))
Sequential 8-second windows at 5 VUs (`15` iterations at 1 VU for `/api/login`):

| Endpoint | Window Throughput | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) | Error % |
|---|---:|---:|---:|---:|---:|---:|
| `GET /api/health` | **10,321.4 req/s** (`82,571` reqs) | 0.00 | 1.03 | 1.51 | 12.20 | 0.00% |
| `GET /api/getAllContacts` | **94.1 req/s** (`753` reqs) | 45.42 | 65.15 | 88.03 | 116.53 | 0.00% |
| `GET /api/get-message/:userId` | **301.8 req/s** (`2,414` reqs) | 8.10 | 10.81 | 13.55 | 49.48 | 0.00% |
| `POST /api/send-message/:receiverId` | **217.4 req/s** (`1,739` reqs) | 5.00 | 8.07 | 12.68 | 50.67 | 0.00% |
| `GET /api/groups` | **326.0 req/s** (`2,608` reqs) | 6.03 | 11.23 | 15.27 | 25.59 | 0.00% |
| `GET /api/groups/:groupId/messages` | **265.5 req/s** (`2,124` reqs) | 10.53 | 17.24 | 21.63 | 38.20 | 0.00% |
| `POST /api/groups/:groupId/send` | **310.9 req/s** (`2,487` reqs) | 7.01 | 12.56 | 18.53 | 32.37 | 0.00% |
| `POST /api/login` (1 VU, 15 reqs) | **15.4 req/s** (avg `64.76 ms`) | 64.19 | 67.86 | 71.69 | 72.65 | 0.00% |

*Baseline System Telemetry ([metrics-baseline.jsonl](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/results/metrics-baseline.jsonl), [os-baseline.jsonl](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/results/os-baseline.jsonl)):* Node CPU peaked at `157.46%` (1 core JS + GC/libuv threads during contacts), RSS peaked at `350.83 MB` (heap peak `136.17 MB`), event-loop lag `p95` peaked at `71.11 ms`, Mongo connections peaked at `12`, peak Mongo ops were `1,438 queries/s` and `343 inserts/s`, and Mongo OS CPU peaked at `131.1%` (`228.75 MB` RSS).

### 2.2 Ramp-Up, Soak, Spike & Socket.IO Runs

| Run | Profile / Load | Avg / Peak RPS | p50 (ms) | p95 (ms) | p99 (ms) | Error / Drop | Node CPU Peak (1-core) | Node RSS Peak / Heap Peak | EL Lag p95 / Max (ms) | Mongo Conns Peak / WT Cache | Mongo OS CPU Peak / RSS |
|---|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| `ramp_health_vus` | 2 -> 200 VUs (20s) | **6,844** / **7,121** | 5.38 | 22.90 | 29.59 | 0.00% / 0 drops | 115.7% | 111.2 / 43.9 MB | 25.6 / 29.2 | 5 / 0.1 MB | 4.7% / 159.8 MB |
| `ramp_health` *(arrival-rate)* | 1k -> 12k/s (18s, 231 VUs) | **559** / **622** | 3.21 | 132.11 | 306.72 | 0% / 37,234 drops | 83.2% | 105.3 / 39.8 MB | 19.4 / 24.0 | 5 / 57.9 MB | 4.6% / 228.7 MB |
| `ramp_contacts` | 10 -> 140 req/s (36s) | **54.0** / **74.8** | 30.91 *(2.44s at end)* | **2,490** | **2,742** | 0% / 282 drops | **179.3%** | **425.3 / 187.2 MB** | **564.1 / 564.1** | **75** / 57.9 MB | 54.6% / 230.3 MB |
| `ramp_get_message` | 50 -> 850 req/s (36s) | **274.8** / **355.4** | 22.80 | 173.32 | 301.32 | 0% / 4,407 drops | 92.0% | 276.9 / 140.1 MB | 62.5 / 73.7 | 43 / 25.0 MB | **229.3%** / 201.2 MB |
| `ramp_send_message` | 40 -> 500 req/s (36s) | **145.6** / **175.6** | 25.23 | 394.30 | 566.69 | 0% / 3,126 drops | 95.0% | 243.6 / 98.5 MB | 140.9 / 239.3 | 46 / 26.0 MB | 40.5% / 199.7 MB |
| `ramp_groups_list` | 30 -> 400 req/s (36s) | **185.9** / **306.0** | 6.02 | 372.15 | 452.74 | 0% / 156 drops | 124.9% | 302.2 / 151.3 MB | 118.6 / 163.2 | 80 / 26.1 MB | 67.0% / 141.8 MB |
| `ramp_group_send_hot` | 20 -> 300 req/s (1 group) | **139.5** / **263.2** | 4.21 | 28.25 *(121ms at 263/s)* | 128.98 | 0% / 14 drops | 117.2% | 164.2 / 63.9 MB | 24.0 / 53.6 | 33 / 33.4 MB | 78.0% / 150.5 MB |
| `ramp_group_msgs` | 30 -> 400 req/s (36s) | **167.0** / **237.0** | 108.58 | **968.93** | **1,233.83** | 0% / 1,296 drops | 131.4% | 351.8 / 169.2 MB | 206.2 / 206.2 | **102 (pool max)** / 40.0 MB | **202.9%** / 155.4 MB |
| `ramp_auth_burst` | 28 concurrent + 15 seq logins + 50/s health | 50.2 total *(~15 login/s)* | 1,687 *(login)* | 1,845 *(login)* / 873 *(health)* | 2,008 *(login)* / 1,663 *(health)* | **30.2% login errs (13 x `429`)** / 40 probe drops | 87.9% | 119.0 / 42.4 MB | 12.6 / **1,665.1** | 7 / 2.9 MB | 3.1% / 160.2 MB |
| `ramp_client_amp` | 2 -> 28 msg/s (`+20x /groups`) | **12.8 msg/s** (`268.4` HTTP/s, peak `487.6`/s) | 17.95 | 133.91 | 169.44 | 0% / 0 drops | 117.2% | 322.2 / 156.6 MB | 50.4 / 63.0 | **84** / 4.8 MB | 78.1% / 171.6 MB |
| `soak` | 100/s target mixed + 40 WS (90s) | **74.8 HTTP/s** (`8,979` reqs) + 40 WS | 5.76 | 36.68 | 380.55 | 0% / 22 drops | 121.3% (37.9% avg) | 344.2 / 156.5 MB | 182.5 / 182.5 | 29 / 38.7 MB | 68.6% / 200.1 MB |
| `spike` | 10 -> 160 -> 10 VUs (48s) | **111.0** / **156.2** (spike) | 603.26 *(978ms peak)* | **1,281.47** *(1,441ms peak)* | **1,458.47** | 0% / 0 drops | **174.2%** | 394.1 / 192.0 MB | **402.1 / 402.1** | **102 (pool max)** / 39.8 MB | 69.0% / 126.5 MB |
| `socketio_storm` | 0 -> 500 WS in 30s | **249,998** `onlineUser` events (**2.25 GB** recv) | 3.0 *(handshake)* | 5.0 *(handshake)* | 7.0 *(handshake)* | 0% WS err (`500/500`) | 91.2% | 120.0 / 45.4 MB | 30.2 / 42.2 | 5 / 39.9 MB | 6.2% / 113.9 MB |
| `socketio_burst` | 0 -> 500 WS in 5s | **236,433** `onlineUser` events (**2.20 GB** / **85 MB/s**) | **334.5** *(handshake)* | **3,893** *(handshake)* | **4,332** *(handshake)* | 0% WS err (`500/500`) | 107.8% | 234.3 / 98.0 MB | **1,599.1 / 3,670.0** | 25 / 0.3 MB | 10.9% / 163.6 MB |

> **Soak stability observation ([metrics-soak.jsonl](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/results/metrics-soak.jsonl)):** Over 90s of sustained mixed REST + 40 WebSockets (`~75 HTTP/s`), `heapUsedMB` sawtoothed cleanly between `47 MB` and `156 MB` with repeated major-GC collections back down to `45–51 MB`. No unbounded memory leak occurred under steady sustainable load; however, `sys_mem_avail` dropped as low as `454–478 MB` during `socketio_burst` and `spike`.

---

## 3. Phase 3: Predicted vs. Actual Comparison & Gap Analysis

| Endpoint / Flow | Predicted Max Sustainable | Actual Observed Max Sustainable / Breaking Point | Gap Explanation |
|---|---|---|---|
| `GET /api/health` | **6,000 – 10,000 req/s** (`150–250` VUs) | **6,844 req/s avg** (`7,121` peak in `ramp_health_vus`, `10,321` req/s at 5 VUs in `baseline`, `p95 = 22.9ms`) | **Aligned.** Note: `ramp_health` (`ramping-arrival-rate`) showed `559 req/s` only because k6 spawned 231 concurrent HTTP connections on the same Windows host, saturating client socket receiving (`http_req_receiving p95 = 105.5ms` vs `waiting p95 = 21.6ms`). |
| `POST /api/login` *(rate-limited)* | **30 req / 15m per IP** (`429` at #31) | **Exact match**: reqs #1–#30 returned `200`, reqs #31–#43 returned **13 x `429`** (`30.23%` fail overall) | **Exact match.** Fixed-window IP limiter tripped immediately on #31. |
| `POST /api/login` *(compute)* | **12 – 20 req/s** (~50–80 ms/req, stalls all routes >1.5s) | **~15.4 req/s** (`avg = 64.76ms`); 28-login burst stalled `/api/health` to **`p95 = 873ms` / `p99 = 1,663ms`** | **Exact match.** Pure-JS `bcryptjs` blocked the single Node event loop (`1,665ms` max lag). |
| `GET /api/getAllContacts` | **35 – 65 req/s**; breaks `80–110 req/s` (`p95 > 500–2,000ms`) | Healthy through **58.6 req/s** (`p95 = 16.9ms`); bent at **74.8 req/s** (`p95 = 66.6ms`); **collapsed at 85+ target (`72.6` -> `51.0` req/s, `p95 = 2,811ms`)** | **Within ~15%.** Empty `profilePic: ""` kept responses at `198 KB` instead of `300 KB`, pushing the cliff slightly from ~65 to ~75 req/s. |
| `GET /api/get-message/:userId` | **300 – 550 req/s**; breaks `>600 req/s` | Healthy at **258.6 req/s** (`p95 = 16.4ms`); knee at **314.6 req/s** (`p95 = 184ms`); plateaued at **355 req/s** | **Lower end of prediction.** Explain & `system.profile` showed missing `_id: -1` in the `Message` compound index forced an in-memory `SORT` stage, pushing `mongod` CPU to `229%` on the co-hosted laptop. |
| `POST /api/send-message/:receiverId` | **150 – 280 req/s**; breaks `>320 req/s` | Healthy at **150.2 req/s** (`p95 = 20.6ms`); bent at **169 req/s** (`p95 = 128.9ms`); plateaued at **175.6 req/s** (`p95 = 560ms`) | **Lower end of prediction.** V8 CPU profiling uncovered `crypto.createPublicKey` running on every `jwt.verify` (`3.68%` of total samples), compounding Mongoose doc validation + 3 serial DB awaits + 5-index write overhead. |
| `GET /api/groups` | **110 – 200 req/s** standalone; breaks at `~10 msg/s` under client fan-out | Standalone healthy at **175.6 req/s** (`p95 = 5.8ms`), knee at **221.6–289.6 req/s**, plateau **306 req/s**. Fan-out hit `p95 = 164.7ms` at **~20 msg/s** (`487` HTTP/s) | **~40% higher than predicted.** The 10 test groups shared 20 users with empty avatars (~25.7 KB vs 60 KB estimated), fitting in WiredTiger's cache (`26 MB`). Still saturated 84 DB conns & `2,125 queries/s` at just `~20 msg/s` under `20x` client fan-out. |
| `POST /api/groups/:groupId/send` *(hot group)* | **45 – 85 req/s** on 1 hot group | Sustained **216.2 req/s** (`p95 = 6.3ms`), spiked 19x at **263.2 req/s** (`p95 = 121.0ms`) | **~2.5x higher before cliff.** Because `0` WS clients were in the hot room, `io.to(groupId).emit` cost nothing, and Mongo 8.3 handled retries until concurrent writes hit the cliff where `writeConflicts: 15` (`39ms` update, `20` multikey index deletes/inserts) kicked in. |
| `GET /api/groups/:groupId/messages` | **130 – 220 req/s**; breaks `>250 req/s` | Healthy to **194.2 req/s** (`p95 = 42ms`); **hard-collapsed at 198–237 req/s** (`p95 = 1,250ms`, **102 DB conns**) | **Exact match**—and worsened dynamically! Once `hotGroupId` grew to `6,253` messages, missing `_id: -1` in `{ groupId: 1, createdAt: -1 }` forced MongoDB to scan & sort all `6,253` docs per call (`28–36ms` DB time). |
| **Socket.IO Storm / Burst** | **60 – 120 connects/s**; collapses `>400` reconnects | 30s ramp: `p95 = 5ms`, **2.25 GB** recv. 5s burst (100/s): **`p95 = 3,893ms`**, **`3.67s` EL lag**, **2.20 GB (`85 MB/s`)** | **Bandwidth/lag matched; 0% disconnects on loopback.** Local loopback sustained `85 MB/s` without tripping Engine.IO's `20s` `pingTimeout`, whereas real WAN clients at `<10 MB/s` would disconnect en masse during the 2.2 GB storm. |

---

## 4. Ranked Bottlenecks & Root-Cause Diagnosis

### Rank 1 (Critical): Unbounded User Scan, Main-Thread Sort & Uncompressed 198 KB JSON in `GET /api/getAllContacts`
- **Impact & Symptoms:** Hard ceiling at **~75 req/s** (regressing to `51 req/s`, `p95 = 2,811ms`), `179.3%` Node CPU, `564 ms` event-loop lag, `425 MB` RSS, `75` open DB connections. Amplified on the client because [Contacts.tsx](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/components/Contacts.tsx#L90-L99) re-fetches `/api/getAllContacts` on every `newMessage` socket event.
- **Profiler & DB Evidence:**
  - `slow-queries-ramp_contacts.json`: **`[]` (zero MongoDB queries > 5ms)** — MongoDB was not the bottleneck (`explain`: `2 ms` for `999` users, `10 ms` for `Message.aggregate`).
  - [cpuprofile-ramp_contacts.json](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/results/cpuprofile-ramp_contacts.json): `express/lib/response.js:json` (`11.07%`) + `stringify` (`3.58%`) = **`14.65%`** of total CPU (`5,990 ms`); `bson` deserialization (`bson.cjs:deserializeObject` `7.16%`, `hexSlice` `5.58%`, `toUTF8` `1.48%`, `parseToElements` `1.14%`) = **`~17%`**; V8 `(garbage collector)` = **`6.22%`** (`2,545 ms`); `auth.controller.js:282` (`localeCompare` sort) = **`1.69%`**.
- **Root Cause:** [auth.controller.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/controllers/auth.controller.js#L245-L298) fetches every user in the database with no `.limit()` or pagination, deserializes all 999 documents into Node objects, runs an expensive `Intl` `localeCompare` sort on the single event loop, and serializes ~198 KB of uncompressed JSON on every call.
- **Recommended Fix & Expected Improvement:**
  1. Add cursor/page pagination (e.g., `?limit=50&search=...`), move sorting to MongoDB or cache the user directory in Redis/memory, and select only `{ fullName, profilePic }` (dropping unused `email`/`createdAt`/`updatedAt`).
  2. In [Contacts.tsx](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/components/Contacts.tsx#L90-L99), update contact order optimistically from the socket payload instead of re-fetching `/api/getAllContacts` on every DM, and enable `compression` middleware.
  - **Expected improvement:** **8–15x higher throughput** (`~600+ req/s`), **>90% payload & GC reduction**, and decoupling contact-list load from DM messaging volume.

---

### Rank 2 (Critical): $O(N^2)$ Socket.IO Presence Broadcast Storm & Single-Node `userSocketMap`
- **Impact & Symptoms:** Just `500` users connecting/disconnecting generated **`249,998` `onlineUser` events** (`2.25 GB` outbound in `socketio_storm`). Over a 5s reconnect burst (`100 connects/s`), Node event-loop lag spiked to **`3,670 ms`**, handshake latency jumped **778x** (`5ms -> 3,893ms p95`), and outbound traffic hit **`85.1 MB/s`**.
- **Profiler Evidence:**
  - [cpuprofile-socketio_burst.json](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/results/cpuprofile-socketio_burst.json): `writev` consumed **`32.0%` of total process time (`9,203.9 ms`)** flushing full ID arrays to 500 sockets; `engine.io/socket.js:flush` (`1.4%`), `in-memory-adapter.js:apply` (`0.7%`), and socket `ErrnoException` (`0.77%`).
- **Root Cause:** [socket.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/services/socket.js#L37-L54) runs `io.emit("onlineUser", Object.keys(userSocketMap))` on every user connect/disconnect, turning $N$ transitions into $O(N^2)$ events and $O(N^3)$ bytes. Process-local `userSocketMap` also prevents multi-instance scaling.
- **Recommended Fix & Expected Improvement:**
  1. Send the full `onlineUser` snapshot **only once to the newly connected socket** (`socket.emit("onlineUser", ...)`), and broadcast **delta events** (`userOnline`, `userOffline` with a single `userId`) or debounce presence diffs every `1–2s`.
  2. Add `@socket.io/redis-adapter` + Redis presence set for horizontal scaling.
  - **Expected improvement:** **>99% reduction in broadcast bytes** during 500-user reconnects (`~2.2 GB` -> `~15 MB`), dropping burst handshake `p95` from **`3.89 s` -> `< 50 ms`**.

---

### Rank 3 (Critical): Single-Thread CPU Starvation via Pure-JS `bcryptjs` & Global IP Lockout Risk
- **Impact & Symptoms:** Maximum login compute throughput is **~15.4 req/s** (`64.8 ms` avg). A concurrent burst of just `28` logins stalled concurrent `/api/health` requests from `0.51 ms` to **`p95 = 873 ms` / `p99 = 1,663 ms`** (`1,665 ms` event-loop freeze). Additionally, requests `#31–#43` hit **`100%` HTTP `429`** (`authLimiter`).
- **Profiler Evidence:**
  - [cpuprofile-ramp_auth_burst.json](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/results/cpuprofile-ramp_auth_burst.json): `bcryptjs` `_encipher` (`11.57%`, `1,929.5 ms`) + `_key` (`0.57%`, `95.9 ms`) accounted for nearly half of all non-idle samples.
- **Root Cause:** [auth.controller.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/controllers/auth.controller.js#L60-L111) uses pure-JS `bcryptjs` (running Blowfish on Node's main JS thread instead of native libuv worker threads). Meanwhile, [rateLimit.middleware.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/rateLimit.middleware.js#L22) keys on `req.ip` without `app.set("trust proxy", 1)` in [server/index.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/index.js).
- **Recommended Fix & Expected Improvement:**
  1. Replace `bcryptjs` with native `bcrypt` or `argon2` (or offload to `worker_threads`), moving password hashing off the main event loop onto multi-core libuv/worker threads.
  2. Configure `app.set("trust proxy", 1)` when behind a reverse proxy, and cap/prune the rate-limiter `Map` (or back with Redis).
  - **Expected improvement:** **4–6x login throughput** on this 6-core host (`~15 -> ~70–90 req/s`) and **elimination of cross-endpoint event-loop freezes** during login spikes (`health p95` stays `< 5 ms`).

---

### Rank 4 (High): Missing `_id: -1` in Message Indexes Causes $O(N_{\text{msgs}})$ Blocking In-Memory `SORT`
- **Impact & Symptoms:** `GET /api/groups/:groupId/messages` collapsed at **198–237 req/s** (`p95 = 1,250 ms`), saturating all **100 Mongoose pool connections** (`102` total) and `202.9%` Mongo OS CPU. `GET /api/get-message/:userId` plateaued at **355 req/s** with `229.3%` Mongo OS CPU.
- **Query Log & Explain Evidence:**
  - [explain-plans.json](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/results/explain-plans.json): Both `getMessage_page1` and `getGroupMessages_page1` show **`stage: "SORT"`** (`sortPattern: { createdAt: -1, _id: -1 }`). For `groupmessages` (500 msgs), `totalKeysExamined: 500, totalDocsExamined: 500` to return `50`.
  - [slow-queries-soak.json](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/results/slow-queries-soak.json): Once `hotGroupId` reached `6,253` messages, every `getGroupMessages?page=1&limit=50` request scanned **`6,253` keys & `6,253` docs** (`hasSortStage: true`), taking **`28–36 ms` in MongoDB alone**.
- **Root Cause:** [Message.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/models/Message.js#L38-L39) indexes `{ senderId: 1, receiverId: 1, createdAt: -1 }` and [GroupMessage.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/models/GroupMessage.js#L38) indexes `{ groupId: 1, createdAt: -1 }`—omitting the `_id: -1` tie-breaker used in `.sort({ createdAt: -1, _id: -1 })`. Additionally, `page > 1` uses `.skip()` instead of cursor pagination.
- **Recommended Fix & Expected Improvement:**
  1. Append `_id: -1` to the compound indexes: `{ groupId: 1, createdAt: -1, _id: -1 }`, `{ senderId: 1, receiverId: 1, createdAt: -1, _id: -1 }`, and `{ receiverId: 1, senderId: 1, createdAt: -1, _id: -1 }`.
  2. Enforce cursor pagination (`before`/`beforeId`) on initial/subsequent pages rather than deep `.skip()`.
  - **Expected improvement:** Reduces docs examined per query from **$O(N_{\text{history}})$ (`6,253`) -> `50` (`125x` less DB work)**, cuts DB CPU by **>70%**, and raises `getGroupMessages` / `getMessage` sustainable throughput **2–3x**.

---

### Rank 5 (High): Client-Triggered `GET /api/groups` 20x Fan-Out + Hot `Group.updatedAt` Multikey Index Contention
- **Impact & Symptoms:**
  1. Simulating [GroupTab.tsx](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/components/GroupTab.tsx#L44-L54) (`newGroupMessage -> GET /api/groups`) amplified `12.8 msg/s` (`20` peak) into **`487.6 req/s`** and **`2,125 queries/s`**, pushing `p95` from `16.8ms -> 164.7ms` and `84` DB connections.
  2. Hammering a single hot group (`ramp_group_send_hot`) triggered an abrupt **19x latency jump** at `263 req/s` (`p95: 6.3ms -> 121.0ms`).
- **Query Log Evidence:**
  - [slow-queries-ramp_group_send_hot.json](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/results/slow-queries-ramp_group_send_hot.json): `findAndModify` on `groups` updating `updatedAt` recorded **`writeConflicts: 15`**, **`numYield: 15`**, **`keysDeleted: 20`**, **`keysInserted: 20`**, taking **`39 ms`** for one update.
- **Root Cause:** Every [sendGroupMessage](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/controllers/group.controller.js#L138) mutates `Group.updatedAt`, forcing WiredTiger write locks on the hot `Group` document and churning all $M$ entries in the `{ members: 1, updatedAt: -1 }` multikey index ([Group.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/models/Group.js#L35)). Meanwhile, clients refetch the entire populated group list on every message.
- **Recommended Fix & Expected Improvement:**
  1. Move `newGroupMessage` sidebar reordering to optimistic client state in `GroupTab.tsx` (eliminating the $M\times$ `GET /api/groups` storm).
  2. Throttle/debounce `Group.updatedAt` writes (e.g., update at most once every 5–10s per group or store `lastMessageAt` in memory/Redis) and cache populated `Group` metadata.
  - **Expected improvement:** Eliminates **~95% of `GET /api/groups` read traffic** during active chats and removes hot-group write-conflict stalls (`p95 < 15 ms` past `300+ msg/s`).

---

### Rank 6 (Medium-High): Per-Request JWT `createPublicKey` Overhead + Mandatory `User.findById` DB Lookup + Mongoose Write Cost
- **Impact & Symptoms:** Limits `POST /api/send-message/:receiverId` to **~160 req/s sustainable / 175 req/s peak** and adds `1` extra Mongo read + crypto overhead to every single authenticated request (`verifyToken`, `sendMessage`, `getMessage`, `groups`, `socketAuth`).
- **Profiler Evidence:**
  - [cpuprofile-ramp_send_message.json](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/results/cpuprofile-ramp_send_message.json): `crypto.createPublicKey` consumed **`3.68%` (`1,445 ms`)** of total samples (second only to socket `writeBuffer` `4.0%`); Mongoose doc creation/hydration (`$set`, `validate`, `cloneObject`, `$toObject`) consumed **`~1.6%`**, and `socket.io-parser` (`encodeAsString` + `hasBinary`) consumed **`~1.0%`**.
- **Root Cause:**
  1. Passing raw `process.env.JWT_SECRET` string to `jwt.verify()` causes Node's crypto layer to build a key object per request (`createPublicKey`).
  2. [verifyToken.middleware.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/verifyToken.middleware.js#L17) runs `User.findById(decoded.userId)` on **every** request, even when routes only need `req.user._id`.
  3. `sendMessage` awaits 3 serial DB queries (`User.findById` -> `User.exists` -> `Message.create` updating 5 indexes).
- **Recommended Fix & Expected Improvement:**
  1. Pre-create `const JWT_KEY = crypto.createSecretKey(Buffer.from(process.env.JWT_SECRET))` once at startup.
  2. Cache active user lookups (`TTL 60s` LRU/Redis) or trust stateless JWT claims for non-sensitive read/send routes (invalidating on password/account change).
  3. Run `User.exists({ _id: receiverId })` only if needed or cache user existence; drop redundant single-field indexes if unused (`senderId_1_createdAt_-1` / `receiverId_1_createdAt_-1` vs compound indexes—note `getAllContacts` uses the compound indexes per `explain`).
  - **Expected improvement:** **~25–40% higher write/read throughput** and **~30–50% lower p50 latency** across all authenticated routes.

---

### Rank 7 (Medium — Unbenchmarked External Risk): Disk-Buffered 1 GB Uploads & Unbounded External Calls
- **Impact & Risk (from static analysis):**
  - [multer.middleware.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/multer.middleware.js#L35-L39) + [cloudinary.middleware.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/cloudinary.middleware.js#L44) buffer up to `10 x 100 MB` (`1 GB` per request) to local disk `uploads/` and fire all 10 Cloudinary uploads in parallel without timeouts or concurrency limits.
  - [firebaseAuth.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/services/firebaseAuth.js#L12-L30) fetches Google certs with no `AbortSignal.timeout` and no in-flight deduplication (`singleflight`) on cold/expired cache.
  - [server/index.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/index.js) lacks `compression`, `maxTimeMS` query timeouts, and a DB-probing `/api/health` (if needed for readiness).
- **Recommended Fix:** Switch media uploads to direct-to-Cloudinary **signed upload URLs** (offloading binary bandwidth & disk I/O completely from Node), add `AbortSignal.timeout(5000)` + promise coalescing to `getFirebasePublicCerts`, add `compression()`, and set `.maxTimeMS(5000)` on Mongo queries.

---

## 5. Deliverables Index

- **Pre-Test Predictions:** [PREDICTIONS.md](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/PREDICTIONS.md)
- **Test Harness & Scripts:**
  - [run-suite.py](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/run-suite.py), [seed.cjs](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/seed.cjs), [monitor-preload.cjs](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/monitor-preload.cjs), [ps-sampler.py](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/ps-sampler.py), [explain-queries.cjs](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/explain-queries.cjs), [aggregate-report-data.py](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/aggregate-report-data.py)
  - k6 scripts: [lib.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/lib.js), [01_baseline.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/01_baseline.js), [02_ramp.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/02_ramp.js), [03_soak.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/03_soak.js), [04_spike.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/04_spike.js), [05_socketio_storm.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/05_socketio_storm.js), [06_health_vus.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/06_health_vus.js), [07_socketio_burst.js](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/k6/07_socketio_burst.js)
- **Raw Results & Profiles:** [load-tests/results/](file:///c:/Users/sanka/OneDrive/Desktop/Chatting%20App/load-tests/results/aggregated-summary.json) (`summary-*.json`, `timeseries-*.json`, `metrics-*.jsonl`, `os-*.jsonl`, `cpuprofile-*.json`, `slow-queries-*.json`, `explain-plans.json`)
