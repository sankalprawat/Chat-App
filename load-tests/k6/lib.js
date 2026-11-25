import { SharedArray } from "k6/data";
import { Trend, Rate, Counter } from "k6/metrics";

const MANIFEST_PATH = __ENV.SEED_MANIFEST || "../.tmp-seed-manifest.json";

export const manifest = new SharedArray("seedManifest", function () {
  return [JSON.parse(open(MANIFEST_PATH))];
});

export function getSeed() {
  return manifest[0];
}

export const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3100";
export const WS_URL = BASE_URL.replace(/^http/, "ws");

export function pickUser(vuId, iter) {
  const users = getSeed().users;
  const idx = (vuId * 13 + iter) % users.length;
  return users[idx];
}

export function pickPartner(userIdx, iter) {
  const users = getSeed().users;
  const partnerIdx = (userIdx + 1 + (iter % 25)) % users.length;
  return users[partnerIdx];
}

export function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export function makeEndpointMetrics(name) {
  return {
    dur: new Trend(`ep_${name}_ms`, true),
    err: new Rate(`ep_${name}_err`),
    cnt: new Counter(`ep_${name}_reqs`),
  };
}

export function recordMetric(m, res, expectedStatus = 200) {
  m.cnt.add(1);
  m.dur.add(res.timings.duration);
  const ok = Array.isArray(expectedStatus)
    ? expectedStatus.includes(res.status)
    : res.status === expectedStatus;
  m.err.add(!ok);
}
