import http from "k6/http";
import { check } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import {
  BASE_URL,
  getSeed,
  pickUser,
  pickPartner,
  authHeaders,
  makeEndpointMetrics,
  recordMetric,
} from "./lib.js";

const TARGET = __ENV.TARGET || "getAllContacts";
const mTarget = makeEndpointMetrics(TARGET);
const mHealthProbe = makeEndpointMetrics("health_probe");
const mRateLimit429 = new Counter("http_429_count");
const mAmpGroups = makeEndpointMetrics("amp_groups_read");

function buildOptions() {
  switch (TARGET) {
    case "health":
      return {
        scenarios: {
          ramp: {
            executor: "ramping-arrival-rate",
            exec: "runTarget",
            startRate: 1000,
            timeUnit: "1s",
            preAllocatedVUs: 60,
            maxVUs: 250,
            stages: [
              { target: 4000, duration: "6s" },
              { target: 8000, duration: "6s" },
              { target: 12000, duration: "6s" },
            ],
          },
        },
      };
    case "getAllContacts":
      return {
        scenarios: {
          ramp: {
            executor: "ramping-arrival-rate",
            exec: "runTarget",
            startRate: 10,
            timeUnit: "1s",
            preAllocatedVUs: 30,
            maxVUs: 200,
            stages: [
              { target: 40, duration: "12s" },
              { target: 80, duration: "12s" },
              { target: 140, duration: "12s" },
            ],
          },
        },
      };
    case "getMessage":
      return {
        scenarios: {
          ramp: {
            executor: "ramping-arrival-rate",
            exec: "runTarget",
            startRate: 50,
            timeUnit: "1s",
            preAllocatedVUs: 40,
            maxVUs: 250,
            stages: [
              { target: 250, duration: "12s" },
              { target: 500, duration: "12s" },
              { target: 850, duration: "12s" },
            ],
          },
        },
      };
    case "sendMessage":
      return {
        scenarios: {
          ramp: {
            executor: "ramping-arrival-rate",
            exec: "runTarget",
            startRate: 40,
            timeUnit: "1s",
            preAllocatedVUs: 40,
            maxVUs: 250,
            stages: [
              { target: 150, duration: "12s" },
              { target: 300, duration: "12s" },
              { target: 500, duration: "12s" },
            ],
          },
        },
      };
    case "getUserGroups":
      return {
        scenarios: {
          ramp: {
            executor: "ramping-arrival-rate",
            exec: "runTarget",
            startRate: 30,
            timeUnit: "1s",
            preAllocatedVUs: 30,
            maxVUs: 200,
            stages: [
              { target: 120, duration: "12s" },
              { target: 240, duration: "12s" },
              { target: 400, duration: "12s" },
            ],
          },
        },
      };
    case "sendGroupMessage_hot":
      return {
        scenarios: {
          ramp: {
            executor: "ramping-arrival-rate",
            exec: "runTarget",
            startRate: 20,
            timeUnit: "1s",
            preAllocatedVUs: 30,
            maxVUs: 200,
            stages: [
              { target: 80, duration: "12s" },
              { target: 180, duration: "12s" },
              { target: 300, duration: "12s" },
            ],
          },
        },
      };
    case "getGroupMessages":
      return {
        scenarios: {
          ramp: {
            executor: "ramping-arrival-rate",
            exec: "runTarget",
            startRate: 30,
            timeUnit: "1s",
            preAllocatedVUs: 30,
            maxVUs: 200,
            stages: [
              { target: 140, duration: "12s" },
              { target: 260, duration: "12s" },
              { target: 400, duration: "12s" },
            ],
          },
        },
      };
    case "getGroupMessages_hot":
      return {
        scenarios: {
          ramp: {
            executor: "ramping-arrival-rate",
            exec: "runTarget",
            startRate: 30,
            timeUnit: "1s",
            preAllocatedVUs: 30,
            maxVUs: 200,
            stages: [
              { target: 140, duration: "12s" },
              { target: 260, duration: "12s" },
              { target: 400, duration: "12s" },
            ],
          },
        },
      };
    case "auth_throughput":
      return {
        scenarios: {
          ramp: {
            executor: "ramping-arrival-rate",
            exec: "runLoginBurst",
            startRate: 10,
            timeUnit: "1s",
            preAllocatedVUs: 20,
            maxVUs: 120,
            stages: [
              { target: 35, duration: "10s" },
              { target: 65, duration: "10s" },
              { target: 100, duration: "10s" },
            ],
          },
        },
      };
    case "auth_login_burst":
      return {
        scenarios: {
          health_probe: {
            executor: "constant-arrival-rate",
            exec: "runHealthProbe",
            rate: 50,
            timeUnit: "1s",
            duration: "14s",
            preAllocatedVUs: 20,
            maxVUs: 50,
          },
          bcrypt_burst: {
            executor: "per-vu-iterations",
            exec: "runLoginBurst",
            vus: 28,
            iterations: 1,
            startTime: "3s",
            maxDuration: "10s",
          },
          rate_limit_wall: {
            executor: "shared-iterations",
            exec: "runLoginBurst",
            vus: 1,
            iterations: 15,
            startTime: "10s",
            maxDuration: "6s",
          },
        },
      };
    case "client_amplified_group":
      return {
        scenarios: {
          ramp: {
            executor: "ramping-arrival-rate",
            exec: "runTarget",
            startRate: 2,
            timeUnit: "1s",
            preAllocatedVUs: 30,
            maxVUs: 180,
            stages: [
              { target: 8, duration: "10s" },
              { target: 16, duration: "10s" },
              { target: 28, duration: "10s" },
            ],
          },
        },
      };
    default:
      throw new Error(`Unknown TARGET=${TARGET}`);
  }
}

export const options = buildOptions();

export function runTarget() {
  const seed = getSeed();
  let res;

  if (TARGET === "health") {
    res = http.get(`${BASE_URL}/api/health`);
  } else if (TARGET === "getAllContacts") {
    const user = pickUser(__VU, __ITER);
    res = http.get(`${BASE_URL}/api/getAllContacts`, {
      headers: authHeaders(user.token),
    });
  } else if (TARGET === "getMessage") {
    const user = seed.users[__VU % 50];
    const partner = seed.users[(user.index + 1 + (__ITER % 20)) % 100];
    res = http.get(
      `${BASE_URL}/api/get-message/${partner.id}?page=1&limit=50`,
      { headers: authHeaders(user.token) }
    );
  } else if (TARGET === "sendMessage") {
    const user = pickUser(__VU, __ITER);
    const partner = pickPartner(user.index, __ITER);
    res = http.post(
      `${BASE_URL}/api/send-message/${partner.id}`,
      JSON.stringify({ text: `ramp dm ${__VU}-${__ITER}` }),
      { headers: authHeaders(user.token) }
    );
  } else if (TARGET === "getUserGroups") {
    const user = seed.users[(__VU + __ITER) % 20];
    res = http.get(`${BASE_URL}/api/groups`, {
      headers: authHeaders(user.token),
    });
  } else if (TARGET === "sendGroupMessage_hot") {
    const user = seed.users[(__VU + __ITER) % 20];
    res = http.post(
      `${BASE_URL}/api/groups/${seed.hotGroupId}/send`,
      JSON.stringify({ text: `hot group msg ${__VU}-${__ITER}` }),
      { headers: authHeaders(user.token) }
    );
  } else if (TARGET === "getGroupMessages") {
    const user = seed.users[(__VU + __ITER) % 20];
    const groupId = seed.groupIds[__ITER % seed.groupIds.length];
    res = http.get(
      `${BASE_URL}/api/groups/${groupId}/messages?page=1&limit=50`,
      { headers: authHeaders(user.token) }
    );
  } else if (TARGET === "getGroupMessages_hot") {
    const user = seed.users[(__VU + __ITER) % 20];
    res = http.get(
      `${BASE_URL}/api/groups/${seed.hotGroupId}/messages?page=1&limit=50`,
      { headers: authHeaders(user.token) }
    );
  } else if (TARGET === "client_amplified_group") {
    const sender = seed.users[(__VU + __ITER) % 20];
    res = http.post(
      `${BASE_URL}/api/groups/${seed.hotGroupId}/send`,
      JSON.stringify({ text: `amp group msg ${__VU}-${__ITER}` }),
      { headers: authHeaders(sender.token) }
    );
    if (res.status === 200) {
      // Mimic GroupTab.tsx: every group member receiving newGroupMessage calls GET /api/groups
      const batchReqs = seed.users.slice(0, 20).map((m) => ({
        method: "GET",
        url: `${BASE_URL}/api/groups`,
        params: { headers: authHeaders(m.token) },
      }));
      const batchRes = http.batch(batchReqs);
      for (const r of batchRes) {
        recordMetric(mAmpGroups, r, 200);
      }
    }
  }

  check(res, { "status 200": (r) => r.status === 200 });
  recordMetric(mTarget, res, 200);
}

export function runHealthProbe() {
  const res = http.get(`${BASE_URL}/api/health`);
  recordMetric(mHealthProbe, res, 200);
}

export function runLoginBurst() {
  const seed = getSeed();
  const user = seed.users[(__VU + __ITER) % seed.users.length];
  const res = http.post(
    `${BASE_URL}/api/login`,
    JSON.stringify({ email: user.email, password: "TestPass123!" }),
    { headers: { "Content-Type": "application/json" } }
  );
  if (res.status === 429) mRateLimit429.add(1);
  recordMetric(mTarget, res, 200);
}
