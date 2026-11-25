import http from "k6/http";
import { check } from "k6";
import { BASE_URL, makeEndpointMetrics, recordMetric } from "./lib.js";

const mHealth = makeEndpointMetrics("health_vus");

export const options = {
  scenarios: {
    ramp_vus: {
      executor: "ramping-vus",
      startVUs: 2,
      stages: [
        { duration: "4s", target: 5 },
        { duration: "4s", target: 20 },
        { duration: "4s", target: 50 },
        { duration: "4s", target: 100 },
        { duration: "4s", target: 200 },
      ],
    },
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, { "health 200": (r) => r.status === 200 });
  recordMetric(mHealth, res, 200);
}
