import argparse
import glob
import json
import math
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOAD_TESTS = ROOT / "load-tests"
RESULTS_DIR = LOAD_TESTS / "results"
MONGOD_EXE = Path(r"C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe")
SCRATCH_DIR = Path(
    r"C:\Users\sanka\.gemini\antigravity\brain\20574cc3-fe25-4974-9e29-0d6869d340bb\scratch"
)
K6_EXE = SCRATCH_DIR / "bin" / "k6.exe"
MONGODATA_DIR = SCRATCH_DIR / "mongodata"
MANIFEST_PATH = SCRATCH_DIR / "seed-manifest.json"
MONGO_PORT = 27018
SERVER_PORT = 3100
MONGO_URI = f"mongodb://127.0.0.1:{MONGO_PORT}/chatApp_loadtest"
JWT_SECRET = "loadtest-local-jwt-secret-only"
BASE_URL = f"http://127.0.0.1:{SERVER_PORT}"


def wait_port(host: str, port: int, timeout: float = 15.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1.0):
                return True
        except OSError:
            time.sleep(0.2)
    raise RuntimeError(f"Timeout waiting for {host}:{port}")


def wait_health(timeout: float = 15.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{BASE_URL}/api/health", timeout=1.0) as r:
                if r.status == 200:
                    data = json.loads(r.read().decode("utf-8"))
                    if data.get("db") == "connected":
                        return True
        except Exception:
            pass
        time.sleep(0.25)
    raise RuntimeError("Server health check timed out")


def aggregate_ndjson_buckets(ndjson_path: Path, bucket_sec: int = 5):
    if not ndjson_path.exists():
        return []
    buckets = {}
    t0 = None
    with ndjson_path.open("r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            rec = json.loads(line)
            if rec.get("type") != "Point":
                continue
            metric = rec.get("metric")
            if metric not in ("http_req_duration", "http_req_failed", "http_reqs", "ws_connecting", "ws_session_duration"):
                continue
            data = rec["data"]
            ts_str = data["time"]
            # Parse ISO timestamp seconds quickly
            # e.g., 2026-11-25T18:55:12.123456+05:30
            from datetime import datetime
            ts = datetime.fromisoformat(ts_str).timestamp()
            if t0 is None:
                t0 = ts
            b_idx = int((ts - t0) // bucket_sec)
            b = buckets.setdefault(b_idx, {"tSec": b_idx * bucket_sec, "reqs": 0, "errs": 0, "durs": []})
            if metric == "http_reqs":
                b["reqs"] += int(data["value"])
            elif metric == "http_req_failed":
                if data["value"] >= 1:
                    b["errs"] += 1
            elif metric == "http_req_duration":
                b["durs"].append(float(data["value"]))

    out = []
    for k in sorted(buckets.keys()):
        b = buckets[k]
        durs = sorted(b["durs"])
        n = len(durs)
        def pct(p):
            if n == 0:
                return 0.0
            idx = min(n - 1, max(0, int(math.ceil(p / 100.0 * n)) - 1))
            return round(durs[idx], 2)
        out.append({
            "tSec": b["tSec"],
            "rps": round(b["reqs"] / bucket_sec, 2),
            "reqCount": b["reqs"],
            "errCount": b["errs"],
            "errRatePct": round((b["errs"] / b["reqs"] * 100.0) if b["reqs"] else 0.0, 2),
            "p50Ms": pct(50),
            "p95Ms": pct(95),
            "p99Ms": pct(99),
            "maxMs": round(durs[-1], 2) if n else 0.0,
        })
    return out


def summarize_cpuprofile(prof_path: Path):
    data = json.loads(prof_path.read_text(encoding="utf-8"))
    nodes = {n["id"]: n for n in data.get("nodes", [])}
    samples = data.get("samples", [])
    deltas = data.get("timeDeltas", [])
    self_us = {}
    total_us = 0
    for sid, dt in zip(samples, deltas):
        total_us += dt
        node = nodes.get(sid)
        if not node:
            continue
        cf = node.get("callFrame", {})
        fn = cf.get("functionName") or "(anonymous)"
        url = cf.get("url") or ""
        line = cf.get("lineNumber", 0)
        key = f"{fn} | {url}:{line}"
        self_us[key] = self_us.get(key, 0) + dt

    top = sorted(self_us.items(), key=lambda x: x[1], reverse=True)[:35]
    return {
        "totalProfiledMs": round(total_us / 1000.0, 2),
        "sampleCount": len(samples),
        "topSelfTimeFunctions": [
            {
                "symbol": k,
                "selfMs": round(v / 1000.0, 2),
                "pct": round((v / total_us * 100.0) if total_us else 0.0, 2),
            }
            for k, v in top
        ],
    }


def start_mongod(clean: bool):
    if clean and MONGODATA_DIR.exists():
        shutil.rmtree(MONGODATA_DIR, ignore_errors=True)
    MONGODATA_DIR.mkdir(parents=True, exist_ok=True)
    log_path = SCRATCH_DIR / "mongod.log"
    proc = subprocess.Popen(
        [
            str(MONGOD_EXE),
            "--dbpath", str(MONGODATA_DIR),
            "--port", str(MONGO_PORT),
            "--bind_ip", "127.0.0.1",
            "--logpath", str(log_path),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    wait_port("127.0.0.1", MONGO_PORT, timeout=20.0)
    return proc


def run_seed():
    env = os.environ.copy()
    env["MONGO_URI"] = MONGO_URI
    env["JWT_SECRET"] = JWT_SECRET
    env["SEED_MANIFEST"] = str(MANIFEST_PATH)
    subprocess.run(["node", str(LOAD_TESTS / "seed.cjs")], env=env, check=True)


def run_single_test(
    run_name: str,
    k6_script: Path,
    mongod_proc: subprocess.Popen,
    extra_env: dict = None,
    enable_cpu_prof: bool = False,
    enable_mongo_prof: bool = False,
    collect_timeseries: bool = True,
    extra_server_env: dict = None,
):
    print(f"\n=== Running {run_name} ({k6_script.name}) ===", flush=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    metrics_jsonl = RESULTS_DIR / f"metrics-{run_name}.jsonl"
    os_jsonl = RESULTS_DIR / f"os-{run_name}.jsonl"
    summary_json = RESULTS_DIR / f"summary-{run_name}.json"
    slow_json = RESULTS_DIR / f"slow-queries-{run_name}.json"
    ts_json = RESULTS_DIR / f"timeseries-{run_name}.json"

    prof_dir = SCRATCH_DIR / f"cpuprof-{run_name}"
    if enable_cpu_prof:
        shutil.rmtree(prof_dir, ignore_errors=True)
        prof_dir.mkdir(parents=True, exist_ok=True)

    stop_signal = SCRATCH_DIR / f"stop-{run_name}.flag"
    stop_signal.unlink(missing_ok=True)

    srv_env = os.environ.copy()
    srv_env.update({
        "PORT": str(SERVER_PORT),
        "MONGO_URI": MONGO_URI,
        "JWT_SECRET": JWT_SECRET,
        "METRICS_LOG_PATH": str(metrics_jsonl),
        "ENABLE_MONGO_PROFILER": "1" if enable_mongo_prof else "0",
        "SLOW_QUERY_LOG_PATH": str(slow_json),
        "STOP_SIGNAL_PATH": str(stop_signal),
        "CLOUDINARY_CLOUD_NAME": "dummy",
        "CLOUDINARY_API_KEY": "dummy",
        "CLOUDINARY_API_SECRET": "dummy",
        "FIREBASE_PROJECT_ID": "dummy",
    })
    if extra_server_env:
        srv_env.update(extra_server_env)

    node_cmd = ["node"]
    if enable_cpu_prof:
        node_cmd.extend(["--cpu-prof", "--cpu-prof-dir", str(prof_dir)])
    node_cmd.extend(["-r", str(LOAD_TESTS / "monitor-preload.cjs"), str(ROOT / "server" / "index.js")])

    srv_log = (SCRATCH_DIR / f"server-{run_name}.log").open("w", encoding="utf-8")
    srv_proc = subprocess.Popen(
        node_cmd,
        cwd=str(ROOT / "server"),
        env=srv_env,
        stdout=srv_log,
        stderr=subprocess.STDOUT,
    )

    sampler_proc = None
    ndjson_tmp = None
    try:
        wait_health(timeout=20.0)
        sampler_proc = subprocess.Popen(
            [sys.executable, str(LOAD_TESTS / "ps-sampler.py"), str(srv_proc.pid), str(mongod_proc.pid), str(os_jsonl)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        k6_cmd = [
            str(K6_EXE), "run",
            "--summary-trend-stats=avg,min,med,p(90),p(95),p(99),max",
            f"--summary-export={summary_json}",
            "-e", f"BASE_URL={BASE_URL}",
            "-e", f"SEED_MANIFEST={MANIFEST_PATH}",
        ]
        if extra_env:
            for k, v in extra_env.items():
                k6_cmd.extend(["-e", f"{k}={v}"])
        if collect_timeseries:
            ndjson_tmp = SCRATCH_DIR / f"raw-{run_name}.ndjson"
            k6_cmd.extend(["--out", f"json={ndjson_tmp}"])
        k6_cmd.append(str(k6_script))

        res = subprocess.run(k6_cmd, cwd=str(LOAD_TESTS), check=False)
        print(f"k6 finished {run_name} with exit code {res.returncode}", flush=True)
    finally:
        # Signal Node to exit gracefully so V8 .cpuprofile & slow queries flush on Windows
        if srv_proc.poll() is None:
            stop_signal.write_text("stop", encoding="utf-8")
            try:
                srv_proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                srv_proc.kill()
                srv_proc.wait()
        stop_signal.unlink(missing_ok=True)
        if sampler_proc and sampler_proc.poll() is None:
            sampler_proc.terminate()
            sampler_proc.wait(timeout=3)
        srv_log.close()

    if ndjson_tmp and ndjson_tmp.exists():
        print(f"Aggregating {run_name} timeseries...", flush=True)
        buckets = aggregate_ndjson_buckets(ndjson_tmp, bucket_sec=5)
        ts_json.write_text(json.dumps(buckets, indent=2), encoding="utf-8")
        ndjson_tmp.unlink(missing_ok=True)

    if enable_cpu_prof:
        profs = list(prof_dir.glob("*.cpuprofile"))
        if profs:
            summary_prof = summarize_cpuprofile(profs[0])
            (RESULTS_DIR / f"cpuprofile-{run_name}.json").write_text(
                json.dumps(summary_prof, indent=2), encoding="utf-8"
            )
            print(f"Saved CPU profile summary for {run_name}", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reseed", action="store_true")
    parser.add_argument("--runs", default="all")
    args = parser.parse_args()

    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    need_seed = args.reseed or not MANIFEST_PATH.exists() or not MONGODATA_DIR.exists()
    mongod_proc = start_mongod(clean=need_seed)
    try:
        if need_seed:
            run_seed()
            env = os.environ.copy()
            env["MONGO_URI"] = MONGO_URI
            env["SEED_MANIFEST"] = str(MANIFEST_PATH)
            env["EXPLAIN_OUT_PATH"] = str(RESULTS_DIR / "explain-plans.json")
            subprocess.run(["node", str(LOAD_TESTS / "explain-queries.cjs")], env=env, check=True)

        selected = set(args.runs.split(",")) if args.runs != "all" else {
            "baseline",
            "ramp_health",
            "ramp_contacts",
            "ramp_get_message",
            "ramp_send_message",
            "ramp_groups_list",
            "ramp_group_send_hot",
            "ramp_group_msgs",
            "ramp_group_msgs_hot",
            "ramp_auth_burst",
            "ramp_auth_throughput",
            "ramp_client_amp",
            "soak",
            "spike",
            "socketio_storm",
        }

        if "baseline" in selected:
            run_single_test("baseline", LOAD_TESTS / "k6" / "01_baseline.js", mongod_proc, collect_timeseries=False)
        if "ramp_health" in selected:
            run_single_test("ramp_health", LOAD_TESTS / "k6" / "02_ramp.js", mongod_proc, {"TARGET": "health"}, collect_timeseries=True)
        if "ramp_health_vus" in selected:
            run_single_test("ramp_health_vus", LOAD_TESTS / "k6" / "06_health_vus.js", mongod_proc, collect_timeseries=True)
        if "socketio_burst" in selected:
            run_single_test("socketio_burst", LOAD_TESTS / "k6" / "07_socketio_burst.js", mongod_proc, enable_cpu_prof=True, collect_timeseries=False)
        if "ramp_contacts" in selected:
            run_single_test("ramp_contacts", LOAD_TESTS / "k6" / "02_ramp.js", mongod_proc, {"TARGET": "getAllContacts"}, enable_cpu_prof=True, enable_mongo_prof=True)
        if "ramp_get_message" in selected:
            run_single_test("ramp_get_message", LOAD_TESTS / "k6" / "02_ramp.js", mongod_proc, {"TARGET": "getMessage"}, enable_mongo_prof=True)
        if "ramp_send_message" in selected:
            run_single_test("ramp_send_message", LOAD_TESTS / "k6" / "02_ramp.js", mongod_proc, {"TARGET": "sendMessage"}, enable_cpu_prof=True)
        if "ramp_groups_list" in selected:
            run_single_test("ramp_groups_list", LOAD_TESTS / "k6" / "02_ramp.js", mongod_proc, {"TARGET": "getUserGroups"})
        if "ramp_group_send_hot" in selected:
            run_single_test("ramp_group_send_hot", LOAD_TESTS / "k6" / "02_ramp.js", mongod_proc, {"TARGET": "sendGroupMessage_hot"}, enable_cpu_prof=True, enable_mongo_prof=True)
        if "ramp_group_msgs" in selected:
            run_single_test("ramp_group_msgs", LOAD_TESTS / "k6" / "02_ramp.js", mongod_proc, {"TARGET": "getGroupMessages"}, enable_cpu_prof=True)
        if "ramp_group_msgs_hot" in selected:
            run_single_test("ramp_group_msgs_hot", LOAD_TESTS / "k6" / "02_ramp.js", mongod_proc, {"TARGET": "getGroupMessages_hot"}, enable_cpu_prof=True, enable_mongo_prof=True)
        if "ramp_auth_burst" in selected:
            run_single_test("ramp_auth_burst", LOAD_TESTS / "k6" / "02_ramp.js", mongod_proc, {"TARGET": "auth_login_burst"}, enable_cpu_prof=True)
        if "ramp_auth_throughput" in selected:
            run_single_test("ramp_auth_throughput", LOAD_TESTS / "k6" / "02_ramp.js", mongod_proc, {"TARGET": "auth_throughput"}, enable_cpu_prof=True, extra_server_env={"AUTH_RATE_LIMIT_MAX": "50000"})
        if "ramp_client_amp" in selected:
            run_single_test("ramp_client_amp", LOAD_TESTS / "k6" / "02_ramp.js", mongod_proc, {"TARGET": "client_amplified_group"})
        if "soak" in selected:
            run_single_test("soak", LOAD_TESTS / "k6" / "03_soak.js", mongod_proc, enable_cpu_prof=True, enable_mongo_prof=True)
        if "spike" in selected:
            run_single_test("spike", LOAD_TESTS / "k6" / "04_spike.js", mongod_proc)
        if "socketio_storm" in selected:
            run_single_test("socketio_storm", LOAD_TESTS / "k6" / "05_socketio_storm.js", mongod_proc, enable_cpu_prof=True)
    finally:
        if mongod_proc.poll() is None:
            mongod_proc.terminate()
            try:
                mongod_proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                mongod_proc.kill()
                mongod_proc.wait()


if __name__ == "__main__":
    main()
