import json
from pathlib import Path

RESULTS = Path(__file__).resolve().parent / "results"


def read_jsonl(path: Path):
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def summarize_metrics(run_name: str):
    node_rows = read_jsonl(RESULTS / f"metrics-{run_name}.jsonl")
    os_rows = read_jsonl(RESULTS / f"os-{run_name}.jsonl")
    if not node_rows and not os_rows:
        return None

    def max_field(rows, fn):
        vals = [fn(r) for r in rows if fn(r) is not None]
        return round(max(vals), 2) if vals else None

    def avg_field(rows, fn):
        vals = [fn(r) for r in rows if fn(r) is not None]
        return round(sum(vals) / len(vals), 2) if vals else None

    return {
        "node_cpu_avg_1core_pct": avg_field(node_rows, lambda r: r["node"]["cpuSingleCorePct"]),
        "node_cpu_peak_1core_pct": max_field(node_rows, lambda r: r["node"]["cpuSingleCorePct"]),
        "node_rss_start_mb": round(node_rows[0]["node"]["rssMB"], 2) if node_rows else None,
        "node_rss_peak_mb": max_field(node_rows, lambda r: r["node"]["rssMB"]),
        "node_heap_peak_mb": max_field(node_rows, lambda r: r["node"]["heapUsedMB"]),
        "el_lag_p95_peak_ms": max_field(node_rows, lambda r: r["node"]["elLagP95Ms"]),
        "el_lag_max_ms": max_field(node_rows, lambda r: r["node"]["elLagMaxMs"]),
        "mongo_conns_peak": max_field(node_rows, lambda r: (r["mongo"] or {}).get("connectionsCurrent")),
        "mongo_wt_cache_peak_mb": max_field(node_rows, lambda r: (r["mongo"] or {}).get("wtCacheMB")),
        "mongo_active_clients_peak": max_field(node_rows, lambda r: (r["mongo"] or {}).get("activeClientsTotal")),
        "mongo_queued_peak": max_field(node_rows, lambda r: (r["mongo"] or {}).get("queuedTotal")),
        "mongo_ops_insert_peak_s": max_field(node_rows, lambda r: ((r["mongo"] or {}).get("deltaOps") or {}).get("insert")),
        "mongo_ops_query_peak_s": max_field(node_rows, lambda r: ((r["mongo"] or {}).get("deltaOps") or {}).get("query")),
        "mongo_ops_update_peak_s": max_field(node_rows, lambda r: ((r["mongo"] or {}).get("deltaOps") or {}).get("update")),
        "mongo_os_cpu_avg_pct": avg_field(os_rows, lambda r: r["mongoOsCpuPct"]),
        "mongo_os_cpu_peak_pct": max_field(os_rows, lambda r: r["mongoOsCpuPct"]),
        "mongo_os_rss_peak_mb": max_field(os_rows, lambda r: r["mongoOsRssMB"]),
        "sys_cpu_peak_pct": max_field(os_rows, lambda r: r["systemCpuPct"]),
        "sys_mem_avail_min_mb": min([r["systemMemAvailMB"] for r in os_rows], default=None),
    }


def main():
    runs = sorted([p.stem.replace("summary-", "") for p in RESULTS.glob("summary-*.json")])
    report = {}
    for run in runs:
        summary = json.loads((RESULTS / f"summary-{run}.json").read_text(encoding="utf-8"))
        metrics = summary.get("metrics", {})
        ts_path = RESULTS / f"timeseries-{run}.json"
        ts = json.loads(ts_path.read_text(encoding="utf-8")) if ts_path.exists() else None
        report[run] = {
            "k6_http_reqs": metrics.get("http_reqs"),
            "k6_http_req_duration": metrics.get("http_req_duration"),
            "k6_http_req_failed": metrics.get("http_req_failed"),
            "k6_dropped_iterations": metrics.get("dropped_iterations"),
            "k6_custom_metrics": {
                k: v for k, v in metrics.items()
                if k.startswith("ep_") or k.startswith("ws_") or k == "http_429_count"
            },
            "system_metrics": summarize_metrics(run),
            "timeseries_buckets": ts,
        }
    out = RESULTS / "aggregated-summary.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {out} for {len(runs)} runs: {', '.join(runs)}")


if __name__ == "__main__":
    main()
