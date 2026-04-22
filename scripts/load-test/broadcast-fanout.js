// k6 scenario: broadcast-fanout
//
// Measures end-to-end broadcast latency (sender clock → peer's received clock)
// while scaling the number of concurrent rooms. Each room has 4 virtual users
// typing at ~8 Hz for 30s. Runs 4 stages back-to-back at 50, 100, 200, 400 rooms.
//
// Headline metric: `broadcast_latency_ms` Trend (p50/p95/p99 per stage).
//
// Prerequisite: server running locally with LOADTEST_ENDPOINT=1.
//   Start: cd server && LOADTEST_ENDPOINT=1 RESUME_TOKEN_SECRET=$(openssl rand -hex 32) npm run dev
//
// Invocation: npm run load-test -- broadcast-fanout

import ws from "k6/ws";
import { check } from "k6";
import { Trend, Counter } from "k6/metrics";

const broadcastLatency = new Trend("broadcast_latency_ms");
const messagesReceived = new Counter("messages_received");
const connectFailures = new Counter("connect_failures");

const STAGES = [
  { rooms: 50,  startTime: "0s",   duration: "40s" },
  { rooms: 100, startTime: "50s",  duration: "40s" },
  { rooms: 200, startTime: "100s", duration: "40s" },
  { rooms: 400, startTime: "150s", duration: "40s" },
];

const PLAYERS_PER_ROOM = 4;
const PROGRESS_HZ = 8;

export const options = {
  scenarios: Object.fromEntries(
    STAGES.map((s) => [
      `rooms_${s.rooms}`,
      {
        executor: "per-vu-iterations",
        vus: s.rooms * PLAYERS_PER_ROOM,
        iterations: 1,
        startTime: s.startTime,
        gracefulStop: "10s",
        exec: "runRace",
        env: { ROOM_COUNT: String(s.rooms), DURATION_S: "30" },
      },
    ])
  ),
};

export function runRace() {
  const target = __ENV.TARGET_URL || "ws://localhost:3001";
  const roomCount = Number(__ENV.ROOM_COUNT);
  const durationMs = Number(__ENV.DURATION_S) * 1000;

  const roomIndex = (__VU - 1) % roomCount;
  const roomCode = `BF-${roomCount}-${roomIndex}`;
  const userId = `vu-${__VU}`;

  const res = ws.connect(`${target}/loadtest`, {}, (socket) => {
    let joined = false;

    socket.on("open", () => {
      socket.send(JSON.stringify({ kind: "join-room", roomCode, userId }));
    });

    socket.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      if (msg.kind === "joined-room") {
        joined = true;
        return;
      }

      if (msg.kind === "player-progress" && msg.userId !== userId) {
        messagesReceived.add(1);
        if (typeof msg.sentAt === "number") {
          const lat = Date.now() - msg.sentAt;
          if (lat >= 0 && lat < 60_000) broadcastLatency.add(lat);
        }
      }
    });

    socket.on("error", () => connectFailures.add(1));

    // Wait until joined, then begin progress loop.
    socket.setTimeout(() => {
      if (!joined) {
        socket.close();
        return;
      }
      const tickMs = 1000 / PROGRESS_HZ;
      let charIndex = 0;
      const ticker = socket.setInterval(() => {
        charIndex += 1;
        socket.send(
          JSON.stringify({
            kind: "typing-progress",
            charIndex,
            sentAt: Date.now(),
          })
        );
      }, tickMs);

      socket.setTimeout(() => {
        // k6's ws setInterval ticks stop automatically on close; no clearInterval needed.
        socket.close();
      }, durationMs);
    }, 500);
  });

  check(res, { connected: (r) => r && r.status === 101 });
}
