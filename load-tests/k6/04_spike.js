import http from "k6/http";
import { sleep } from "k6";
import {
  BASE_URL,
  getSeed,
  pickUser,
  pickPartner,
  authHeaders,
  makeEndpointMetrics,
  recordMetric,
} from "./lib.js";

const mAll = makeEndpointMetrics("spike_all");
const mContacts = makeEndpointMetrics("spike_contacts");
const mSend = makeEndpointMetrics("spike_send");

export const options = {
  scenarios: {
    spike: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "12s", target: 10 },  // Pre-spike baseline
        { duration: "2s", target: 160 },  // Sudden 16x spike
        { duration: "18s", target: 160 }, // Hold spike
        { duration: "2s", target: 10 },   // Drop back to baseline
        { duration: "16s", target: 10 },  // Recovery observation
      ],
    },
  },
};

export default function () {
  const seed = getSeed();
  const roll = (__VU * 17 + __ITER) % 10;

  let res;
  if (roll < 3) {
    const user = pickUser(__VU, __ITER);
    res = http.get(`${BASE_URL}/api/getAllContacts`, {
      headers: authHeaders(user.token),
    });
    recordMetric(mContacts, res, 200);
  } else if (roll < 6) {
    const user = pickUser(__VU, __ITER);
    const partner = pickPartner(user.index, __ITER);
    res = http.post(
      `${BASE_URL}/api/send-message/${partner.id}`,
      JSON.stringify({ text: `spike dm ${__VU}-${__ITER}` }),
      { headers: authHeaders(user.token) }
    );
    recordMetric(mSend, res, 200);
  } else if (roll < 8) {
    const user = seed.users[(__VU + __ITER) % 20];
    res = http.get(`${BASE_URL}/api/groups`, {
      headers: authHeaders(user.token),
    });
  } else {
    const user = seed.users[__VU % 50];
    const partner = seed.users[(user.index + 1 + (__ITER % 20)) % 100];
    res = http.get(
      `${BASE_URL}/api/get-message/${partner.id}?page=1&limit=50`,
      { headers: authHeaders(user.token) }
    );
  }

  recordMetric(mAll, res, 200);
  sleep(0.1);
}
