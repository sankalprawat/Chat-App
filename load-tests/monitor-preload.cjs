// Loaded via `node -r ./load-tests/monitor-preload.cjs server/index.js`
// Records Node event loop delay, heap/CPU usage, and MongoDB serverStatus + slow queries without modifying server code.
const fs = require("fs");
const path = require("path");
const { monitorEventLoopDelay } = require("perf_hooks");

const metricsPath = process.env.METRICS_LOG_PATH;
const enableMongoProfiler = process.env.ENABLE_MONGO_PROFILER === "1";
const slowQueryLogPath = process.env.SLOW_QUERY_LOG_PATH;

if (metricsPath) {
  fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
  fs.writeFileSync(metricsPath, "");
}

const elMonitor = monitorEventLoopDelay({ resolution: 10 });
elMonitor.enable();

let prevCpu = process.cpuUsage();
let prevTime = process.hrtime.bigint();
let prevOps = null;
let profilerEnabled = false;

// Lazily hook mongoose once the app requires it
const mongoose = require(path.resolve(__dirname, "../server/node_modules/mongoose"));

async function collectSample() {
  if (!metricsPath) return;

  const nowTime = process.hrtime.bigint();
  const elapsedMs = Number(nowTime - prevTime) / 1e6;
  const cpuDelta = process.cpuUsage(prevCpu);
  prevCpu = process.cpuUsage();
  prevTime = nowTime;

  const cpuSingleCorePct =
    elapsedMs > 0 ? ((cpuDelta.user + cpuDelta.system) / (elapsedMs * 1000)) * 100 : 0;
  const mem = process.memoryUsage();

  const sample = {
    ts: new Date().toISOString(),
    node: {
      cpuSingleCorePct: Number(cpuSingleCorePct.toFixed(2)),
      rssMB: Number((mem.rss / 1048576).toFixed(2)),
      heapUsedMB: Number((mem.heapUsed / 1048576).toFixed(2)),
      heapTotalMB: Number((mem.heapTotal / 1048576).toFixed(2)),
      externalMB: Number((mem.external / 1048576).toFixed(2)),
      elLagP50Ms: Number((elMonitor.percentile(50) / 1e6).toFixed(2)),
      elLagP95Ms: Number((elMonitor.percentile(95) / 1e6).toFixed(2)),
      elLagP99Ms: Number((elMonitor.percentile(99) / 1e6).toFixed(2)),
      elLagMaxMs: Number((elMonitor.max / 1e6).toFixed(2)),
    },
    mongo: null,
  };
  elMonitor.reset();

  try {
    if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const db = mongoose.connection.db;
      if (enableMongoProfiler && !profilerEnabled) {
        profilerEnabled = true;
        await db.command({ profile: 1, slowms: 5 }).catch(() => {});
      }

      const status = await db.admin().serverStatus();
      const ops = status.opcounters || {};
      const deltaOps = prevOps
        ? {
            insert: (ops.insert || 0) - (prevOps.insert || 0),
            query: (ops.query || 0) - (prevOps.query || 0),
            update: (ops.update || 0) - (prevOps.update || 0),
            delete: (ops.delete || 0) - (prevOps.delete || 0),
            command: (ops.command || 0) - (prevOps.command || 0),
          }
        : null;
      prevOps = { ...ops };

      sample.mongo = {
        connectionsCurrent: status.connections?.current,
        connectionsAvailable: status.connections?.available,
        activeClientsTotal: status.globalLock?.activeClients?.total,
        activeClientsReaders: status.globalLock?.activeClients?.readers,
        activeClientsWriters: status.globalLock?.activeClients?.writers,
        queuedTotal: status.globalLock?.currentQueue?.total,
        memResidentMB: status.mem?.resident,
        wtCacheMB: status.wiredTiger?.cache
          ? Number((status.wiredTiger.cache["bytes currently in the cache"] / 1048576).toFixed(2))
          : null,
        wtReadTicketsAvail: status.wiredTiger?.concurrentTransactions?.read?.available,
        wtWriteTicketsAvail: status.wiredTiger?.concurrentTransactions?.write?.available,
        deltaOps,
      };
    }
  } catch {
    // Ignore transient errors while connecting/shutting down
  }

  try {
    fs.appendFileSync(metricsPath, JSON.stringify(sample) + "\n");
  } catch {
    // ignore
  }
}

const timer = setInterval(collectSample, 1000);
if (typeof timer.unref === "function") timer.unref();

async function dumpSlowQueriesAndExit(code = 0) {
  try {
    await collectSample();
    if (
      enableMongoProfiler &&
      slowQueryLogPath &&
      mongoose.connection?.readyState === 1 &&
      mongoose.connection.db
    ) {
      const entries = await mongoose.connection.db
        .collection("system.profile")
        .find({})
        .sort({ millis: -1 })
        .limit(200)
        .toArray();
      fs.mkdirSync(path.dirname(slowQueryLogPath), { recursive: true });
      fs.writeFileSync(slowQueryLogPath, JSON.stringify(entries, null, 2));
    }
  } catch {
    // ignore
  }
  process.exit(code);
}

const stopSignalPath = process.env.STOP_SIGNAL_PATH;
if (stopSignalPath) {
  const stopWatcher = setInterval(() => {
    if (fs.existsSync(stopSignalPath)) {
      clearInterval(stopWatcher);
      dumpSlowQueriesAndExit(0);
    }
  }, 250);
  if (typeof stopWatcher.unref === "function") stopWatcher.unref();
}

process.on("SIGINT", () => dumpSlowQueriesAndExit(0));
process.on("SIGTERM", () => dumpSlowQueriesAndExit(0));
