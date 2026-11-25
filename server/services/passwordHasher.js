const os = require("os");
const path = require("path");
const { Worker } = require("worker_threads");
const bcrypt = require("bcryptjs");

const WORKER_SCRIPT = path.join(__dirname, "passwordWorker.js");

function getPoolSize() {
  const cpus =
    typeof os.availableParallelism === "function"
      ? os.availableParallelism()
      : os.cpus().length;
  return Math.max(2, Math.min(4, cpus || 2));
}

class PasswordWorkerPool {
  constructor(size = getPoolSize()) {
    this.size = size;
    this.workers = [];
    this.nextWorkerIdx = 0;
    this.nextJobId = 1;
  }

  ensureWorker(slot) {
    const existing = this.workers[slot];
    if (existing && !existing.terminated) {
      return existing;
    }

    const worker = new Worker(WORKER_SCRIPT);
    const pending = new Map();
    const entry = { worker, pending, terminated: false };

    worker.on("message", ({ id, ok, result, error }) => {
      const job = pending.get(id);
      if (!job) return;
      pending.delete(id);
      if (pending.size === 0 && typeof worker.unref === "function") {
        worker.unref();
      }
      if (ok) {
        job.resolve(result);
      } else {
        job.reject(new Error(error));
      }
    });

    const failPending = (err) => {
      entry.terminated = true;
      for (const [, job] of pending) {
        job.reject(err);
      }
      pending.clear();
    };

    worker.on("error", failPending);
    worker.on("exit", (code) => {
      if (!entry.terminated) {
        failPending(new Error(`Password worker exited unexpectedly (${code})`));
      }
    });

    if (typeof worker.unref === "function") {
      worker.unref();
    }

    this.workers[slot] = entry;
    return entry;
  }

  run(op, args) {
    // Pick worker with fewest active jobs for even multi-core load balancing
    let chosenSlot = this.nextWorkerIdx % this.size;
    let minLoad = Infinity;
    for (let i = 0; i < this.size; i++) {
      const idx = (this.nextWorkerIdx + i) % this.size;
      const entry = this.ensureWorker(idx);
      if (entry.pending.size < minLoad) {
        minLoad = entry.pending.size;
        chosenSlot = idx;
        if (minLoad === 0) break;
      }
    }
    this.nextWorkerIdx = (chosenSlot + 1) % this.size;

    const entry = this.ensureWorker(chosenSlot);
    const id = this.nextJobId++;

    return new Promise((resolve, reject) => {
      entry.pending.set(id, { resolve, reject });
      if (typeof entry.worker.ref === "function") {
        entry.worker.ref();
      }
      entry.worker.postMessage({ id, op, args });
    });
  }

  async destroy() {
    const workers = this.workers.splice(0, this.workers.length);
    await Promise.all(
      workers.map((entry) => {
        if (!entry) return Promise.resolve();
        entry.terminated = true;
        return entry.worker.terminate();
      })
    );
  }
}

let pool = null;

function getPool() {
  if (!pool) {
    pool = new PasswordWorkerPool();
  }
  return pool;
}

async function hashPassword(password, rounds = 10) {
  if (process.env.NODE_ENV === "test") {
    return bcrypt.hash(password, rounds);
  }
  return getPool().run("hash", [password, rounds]);
}

async function comparePassword(password, hash) {
  if (process.env.NODE_ENV === "test") {
    return bcrypt.compare(password, hash);
  }
  return getPool().run("compare", [password, hash]);
}

function warmupPasswordPool() {
  if (process.env.NODE_ENV === "test") return;
  const p = getPool();
  for (let i = 0; i < p.size; i++) {
    p.ensureWorker(i);
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  warmupPasswordPool,
  PasswordWorkerPool,
};
