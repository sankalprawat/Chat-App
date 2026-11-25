import json
import os
import sys
import time
import psutil

def main():
    if len(sys.argv) < 4:
        print("Usage: ps-sampler.py <node_pid> <mongod_pid> <out_jsonl>", file=sys.stderr)
        sys.exit(1)

    node_pid = int(sys.argv[1])
    mongo_pid = int(sys.argv[2])
    out_path = sys.argv[3]

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    node_proc = psutil.Process(node_pid)
    mongo_proc = psutil.Process(mongo_pid)

    # Prime cpu_percent counters
    node_proc.cpu_percent(interval=None)
    mongo_proc.cpu_percent(interval=None)
    psutil.cpu_percent(interval=None)

    with open(out_path, "w", encoding="utf-8") as f:
        while True:
            time.sleep(1.0)
            try:
                if not node_proc.is_running() or not mongo_proc.is_running():
                    break
                n_cpu = node_proc.cpu_percent(interval=None)
                n_mem = node_proc.memory_info().rss / 1048576.0
                m_cpu = mongo_proc.cpu_percent(interval=None)
                m_mem = mongo_proc.memory_info().rss / 1048576.0
                sys_cpu = psutil.cpu_percent(interval=None)
                vm = psutil.virtual_memory()
                rec = {
                    "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "systemCpuPct": round(sys_cpu, 2),
                    "systemMemUsedPct": round(vm.percent, 2),
                    "systemMemAvailMB": round(vm.available / 1048576.0, 2),
                    "nodeOsCpuPct": round(n_cpu, 2),
                    "nodeOsRssMB": round(n_mem, 2),
                    "mongoOsCpuPct": round(m_cpu, 2),
                    "mongoOsRssMB": round(m_mem, 2),
                }
                f.write(json.dumps(rec) + "\n")
                f.flush()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                break

if __name__ == "__main__":
    main()
