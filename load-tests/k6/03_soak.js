import http from "k6/http";
import ws from "k6/ws";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import {
  BASE_URL,
  WS_URL,
  getSeed,
  pickUser,
  pickPartner,
  authHeaders,
  makeEndpointMetrics,
  recordMetric,
} from "./lib.js";

const mMixRead = makeEndpointMetrics("soak_dm_read");
const mMixSend = makeEndpointMetrics("soak_dm_send");
const mMixGrpMsg = makeEndpointMetrics("soak_grp_msgs");
const mMixGrpSend = makeEndpointMetrics("soak_grp_send");
const mMixGrpList = makeEndpointMetrics("soak_grp_list");
const mMixContacts = makeEndpointMetrics("soak_contacts");
const wsConnectErr = new Counter("ws_connect_errors");
const wsMsgsRecv = new Counter("ws_messages_received");

export const options = {
  scenarios: {
    mixed_rest: {
      executor: "constant-arrival-rate",
      exec: "runMixedRest",
      rate: 100,
      timeUnit: "1s",
      duration: "90s",
      preAllocatedVUs: 40,
      maxVUs: 160,
    },
    steady_ws: {
      executor: "constant-vus",
      exec: "runSteadyWs",
      vus: 40,
      duration: "90s",
    },
  },
};

export function runMixedRest() {
  const seed = getSeed();
  const roll = (__VU * 37 + __ITER) % 100;

  if (roll < 35) {
    const user = seed.users[__VU % 50];
    const partner = seed.users[(user.index + 1 + (__ITER % 20)) % 100];
    const res = http.get(
      `${BASE_URL}/api/get-message/${partner.id}?page=1&limit=50`,
      { headers: authHeaders(user.token) }
    );
    recordMetric(mMixRead, res, 200);
  } else if (roll < 60) {
    const user = pickUser(__VU, __ITER);
    const partner = pickPartner(user.index, __ITER);
    const res = http.post(
      `${BASE_URL}/api/send-message/${partner.id}`,
      JSON.stringify({ text: `soak dm ${__VU}-${__ITER}` }),
      { headers: authHeaders(user.token) }
    );
    recordMetric(mMixSend, res, 200);
  } else if (roll < 75) {
    const user = seed.users[(__VU + __ITER) % 20];
    const gid = seed.groupIds[__ITER % seed.groupIds.length];
    const res = http.get(`${BASE_URL}/api/groups/${gid}/messages?page=1&limit=50`, {
      headers: authHeaders(user.token),
    });
    recordMetric(mMixGrpMsg, res, 200);
  } else if (roll < 85) {
    const user = seed.users[(__VU + __ITER) % 20];
    const gid = seed.groupIds[__ITER % seed.groupIds.length];
    const res = http.post(
      `${BASE_URL}/api/groups/${gid}/send`,
      JSON.stringify({ text: `soak grp ${__VU}-${__ITER}` }),
      { headers: authHeaders(user.token) }
    );
    recordMetric(mMixGrpSend, res, 200);
  } else if (roll < 95) {
    const user = seed.users[(__VU + __ITER) % 20];
    const res = http.get(`${BASE_URL}/api/groups`, {
      headers: authHeaders(user.token),
    });
    recordMetric(mMixGrpList, res, 200);
  } else {
    const user = pickUser(__VU, __ITER);
    const res = http.get(`${BASE_URL}/api/getAllContacts`, {
      headers: authHeaders(user.token),
    });
    recordMetric(mMixContacts, res, 200);
  }
}

export function runSteadyWs() {
  const seed = getSeed();
  const user = seed.users[__VU % seed.users.length];
  const url = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;

  const res = ws.connect(url, {}, function (socket) {
    socket.on("message", function (msg) {
      wsMsgsRecv.add(1);
      if (msg.startsWith("0")) {
        socket.send(`40{"token":"${user.token}"}`);
      } else if (msg === "2") {
        socket.send("3");
      }
    });

    socket.on("error", function () {
      wsConnectErr.add(1);
    });

    socket.setTimeout(function () {
      socket.close();
    }, 85000);
  });

  if (!res || res.status !== 101) {
    wsConnectErr.add(1);
    sleep(2);
  }
}
