import http from "k6/http";
import { check } from "k6";
import {
  BASE_URL,
  getSeed,
  pickUser,
  pickPartner,
  authHeaders,
  makeEndpointMetrics,
  recordMetric,
} from "./lib.js";

const mHealth = makeEndpointMetrics("health");
const mContacts = makeEndpointMetrics("contacts");
const mDmRead = makeEndpointMetrics("dm_read");
const mDmSend = makeEndpointMetrics("dm_send");
const mGroups = makeEndpointMetrics("groups_list");
const mGroupMsgs = makeEndpointMetrics("group_messages");
const mGroupSend = makeEndpointMetrics("group_send");
const mLogin = makeEndpointMetrics("auth_login");

export const options = {
  scenarios: {
    health: {
      executor: "constant-vus",
      exec: "runHealth",
      vus: 5,
      duration: "8s",
      startTime: "0s",
    },
    contacts: {
      executor: "constant-vus",
      exec: "runContacts",
      vus: 5,
      duration: "8s",
      startTime: "9s",
    },
    dm_read: {
      executor: "constant-vus",
      exec: "runDmRead",
      vus: 5,
      duration: "8s",
      startTime: "18s",
    },
    dm_send: {
      executor: "constant-vus",
      exec: "runDmSend",
      vus: 5,
      duration: "8s",
      startTime: "27s",
    },
    groups_list: {
      executor: "constant-vus",
      exec: "runGroupsList",
      vus: 5,
      duration: "8s",
      startTime: "36s",
    },
    group_messages: {
      executor: "constant-vus",
      exec: "runGroupMessages",
      vus: 5,
      duration: "8s",
      startTime: "45s",
    },
    group_send: {
      executor: "constant-vus",
      exec: "runGroupSend",
      vus: 5,
      duration: "8s",
      startTime: "54s",
    },
    auth_login: {
      executor: "shared-iterations",
      exec: "runLogin",
      vus: 1,
      iterations: 15,
      maxDuration: "10s",
      startTime: "63s",
    },
  },
};

export function runHealth() {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, { "health 200": (r) => r.status === 200 });
  recordMetric(mHealth, res, 200);
}

export function runContacts() {
  const user = pickUser(__VU, __ITER);
  const res = http.get(`${BASE_URL}/api/getAllContacts`, {
    headers: authHeaders(user.token),
  });
  check(res, { "contacts 200": (r) => r.status === 200 });
  recordMetric(mContacts, res, 200);
}

export function runDmRead() {
  const seed = getSeed();
  const user = seed.users[__VU % 50];
  const partner = seed.users[(user.index + 1 + (__ITER % 20)) % 100];
  const res = http.get(
    `${BASE_URL}/api/get-message/${partner.id}?page=1&limit=50`,
    { headers: authHeaders(user.token) }
  );
  check(res, { "dm_read 200": (r) => r.status === 200 });
  recordMetric(mDmRead, res, 200);
}

export function runDmSend() {
  const user = pickUser(__VU, __ITER);
  const partner = pickPartner(user.index, __ITER);
  const res = http.post(
    `${BASE_URL}/api/send-message/${partner.id}`,
    JSON.stringify({ text: `baseline dm ${__VU}-${__ITER}` }),
    { headers: authHeaders(user.token) }
  );
  check(res, { "dm_send 200": (r) => r.status === 200 });
  recordMetric(mDmSend, res, 200);
}

export function runGroupsList() {
  const seed = getSeed();
  const user = seed.users[(__VU + __ITER) % 20];
  const res = http.get(`${BASE_URL}/api/groups`, {
    headers: authHeaders(user.token),
  });
  check(res, { "groups 200": (r) => r.status === 200 });
  recordMetric(mGroups, res, 200);
}

export function runGroupMessages() {
  const seed = getSeed();
  const user = seed.users[(__VU + __ITER) % 20];
  const groupId = seed.groupIds[__ITER % seed.groupIds.length];
  const res = http.get(
    `${BASE_URL}/api/groups/${groupId}/messages?page=1&limit=50`,
    { headers: authHeaders(user.token) }
  );
  check(res, { "group_msgs 200": (r) => r.status === 200 });
  recordMetric(mGroupMsgs, res, 200);
}

export function runGroupSend() {
  const seed = getSeed();
  const user = seed.users[(__VU + __ITER) % 20];
  const groupId = seed.groupIds[__ITER % seed.groupIds.length];
  const res = http.post(
    `${BASE_URL}/api/groups/${groupId}/send`,
    JSON.stringify({ text: `baseline grp ${__VU}-${__ITER}` }),
    { headers: authHeaders(user.token) }
  );
  check(res, { "group_send 200": (r) => r.status === 200 });
  recordMetric(mGroupSend, res, 200);
}

export function runLogin() {
  const seed = getSeed();
  const user = seed.users[__ITER % seed.users.length];
  const res = http.post(
    `${BASE_URL}/api/login`,
    JSON.stringify({ email: user.email, password: "TestPass123!" }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(res, { "login 200": (r) => r.status === 200 });
  recordMetric(mLogin, res, 200);
}
