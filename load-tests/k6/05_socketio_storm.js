import ws from "k6/ws";
import { sleep } from "k6";
import { Counter, Trend, Rate } from "k6/metrics";
import { WS_URL, getSeed } from "./lib.js";

const wsHandshakeMs = new Trend("ws_sio_handshake_ms", true);
const wsConnOk = new Rate("ws_sio_connect_ok");
const wsOnlineEvents = new Counter("ws_online_user_events");
const wsBytesRecv = new Counter("ws_payload_bytes_received");

export const options = {
  scenarios: {
    connect_storm: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 150 },
        { duration: "10s", target: 350 },
        { duration: "10s", target: 500 },
        { duration: "10s", target: 500 },
        { duration: "5s", target: 0 },
      ],
    },
  },
};

export default function () {
  const seed = getSeed();
  // Use unique user per VU where possible up to 200, or wrap cleanly
  const user = seed.users[(__VU - 1) % seed.users.length];
  const url = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;
  const started = Date.now();
  let acked = false;

  const res = ws.connect(url, {}, function (socket) {
    socket.on("message", function (msg) {
      wsBytesRecv.add(msg.length);
      if (msg.startsWith("0")) {
        socket.send(`40{"token":"${user.token}"}`);
      } else if (msg.startsWith("40")) {
        if (!acked) {
          acked = true;
          wsHandshakeMs.add(Date.now() - started);
          wsConnOk.add(1);
        }
      } else if (msg.startsWith('42["onlineUser"')) {
        wsOnlineEvents.add(1);
      } else if (msg === "2") {
        socket.send("3");
      }
    });

    socket.on("error", function () {
      if (!acked) wsConnOk.add(0);
    });

    socket.setTimeout(function () {
      socket.close();
    }, 44000);
  });

  if (!res || res.status !== 101) {
    wsConnOk.add(0);
  }
  sleep(1);
}
