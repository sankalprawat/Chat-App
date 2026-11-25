const { parentPort } = require("worker_threads");
const bcrypt = require("bcryptjs");

if (!parentPort) {
  throw new Error("passwordWorker must be run inside a Worker thread");
}

parentPort.on("message", async ({ id, op, args }) => {
  try {
    let result;
    if (op === "hash") {
      result = await bcrypt.hash(args[0], args[1]);
    } else if (op === "compare") {
      result = await bcrypt.compare(args[0], args[1]);
    } else {
      throw new Error(`Unsupported password worker op: ${op}`);
    }
    parentPort.postMessage({ id, ok: true, result });
  } catch (err) {
    parentPort.postMessage({ id, ok: false, error: err?.message || String(err) });
  }
});
