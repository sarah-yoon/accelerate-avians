# Phase 3 — Load Test on Isolated Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce the measured numbers the resume bullet needs — concurrent rooms sustained, end-to-end broadcast latency p50/p99, DB-finalize latency under burst, KICK enforcement under load, RSS + FD stability under reconnect storm. Document results in `docs/netcode.md` so the bullet's `{N}` / `{X}` placeholders can be filled from a committed source.

**Architecture:** All scenarios use k6 with WebSocket support, pointed at a locally-running server. Safety enforced by a TypeScript wrapper that (a) refuses non-localhost targets, (b) acquires a PID-checked lockfile, (c) caps duration at 5 minutes. k6 emits JSON metrics that a small parser renders into the markdown tables in `docs/netcode.md`.

**Tech Stack:** k6 (WebSocket + built-in metrics), TypeScript wrapper, Vitest for the wrapper's unit tests, Node 20 server (Express + Socket.IO).

**Spec section:** § 2.5 of `docs/superpowers/specs/2026-04-16-netcode-and-polish-design.md`.

**Dependencies:** Phase 1 (server-authoritative scoring, merged `887a375`) and Phase 2 (reconnection + transport tuning, merged `fd656f0`). Both already on `main`.

---

## File Structure

| Path | Change | Responsibility |
|------|--------|----------------|
| `scripts/load-test.ts` | **new** | Entry point: allowlist, lockfile, k6 invocation, JSON-result aggregation |
| `scripts/load-test.test.ts` | **new** | Unit tests for allowlist + lockfile guards |
| `scripts/load-test/broadcast-fanout.js` | **new** | k6 WebSocket scenario — 50/100/200/400 rooms, end-to-end progress latency |
| `scripts/load-test/db-finalize.js` | **new** | k6 scenario — 200 rooms finish within 5s, measure MatchPlayer.updateMany latency |
| `scripts/load-test/rate-limiter.js` | **new** | k6 scenario — client exceeds 30 updates/sec, expect KICK within 1s |
| `scripts/load-test/reconnect-storm.js` | **new** | k6 scenario — 50 simultaneous reconnects, RSS + FD sampled from a companion Node probe |
| `scripts/load-test/slow-consumer.js` | **new** | k6 scenario — artificial 5Mbps cap, verify buffer-overflow disconnect fires |
| `scripts/load-test/lib/common.js` | **new** | Shared k6 helpers (client factory, room-join sequence, latency metric names) |
| `scripts/load-test/sample-server-metrics.ts` | **new** | Probe script spawned alongside k6 — samples RSS and FD count every 2s |
| `docs/netcode.md` | **new** | Master writeup: problem statement, server-authority, interpolation, clock sync, anti-cheat, reconnect protocol, load-test methodology + results, trade-offs, secrets & config |
| `README.md` | modify | Link to `docs/netcode.md`; fill in measured capacity sentence |
| `package.json` | modify | Add `npm run load-test` script that calls `scripts/load-test.ts` |

---

## Task 1: Install k6 and scaffold the wrapper entry

**Prereq:** macOS Homebrew. k6 is not currently installed (`which k6` exits 1).

**Files:**
- Create: `scripts/load-test.ts`
- Create: `scripts/load-test.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Install k6**

```bash
brew install k6
k6 version
```
Expected: prints `k6 v0.5x.x` (or later). If Homebrew is missing, the engineer installs it first or gets k6 binary from https://k6.io/docs/get-started/installation/.

- [ ] **Step 2: Write failing tests**

Create `scripts/load-test.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertLocalhostTarget, acquireLockfile, releaseLockfile, LOCKFILE_PATH } from "./load-test.js";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";

describe("assertLocalhostTarget", () => {
  it("accepts localhost, 127.0.0.1, ::1", () => {
    expect(() => assertLocalhostTarget("ws://localhost:3001")).not.toThrow();
    expect(() => assertLocalhostTarget("ws://127.0.0.1:3001")).not.toThrow();
    expect(() => assertLocalhostTarget("ws://[::1]:3001")).not.toThrow();
  });

  it("rejects non-localhost hostnames", () => {
    expect(() => assertLocalhostTarget("wss://accelerate-avians.up.railway.app")).toThrow(/non-local/i);
    expect(() => assertLocalhostTarget("ws://staging.example.com:3001")).toThrow(/non-local/i);
  });

  it("accepts non-localhost only when ALLOW_NON_LOCAL=1 is set", () => {
    const orig = process.env.ALLOW_NON_LOCAL;
    try {
      process.env.ALLOW_NON_LOCAL = "1";
      expect(() => assertLocalhostTarget("ws://staging.example.com:3001")).not.toThrow();
    } finally {
      if (orig === undefined) delete process.env.ALLOW_NON_LOCAL;
      else process.env.ALLOW_NON_LOCAL = orig;
    }
  });
});

describe("lockfile", () => {
  beforeEach(() => {
    if (existsSync(LOCKFILE_PATH)) unlinkSync(LOCKFILE_PATH);
  });

  afterEach(() => {
    if (existsSync(LOCKFILE_PATH)) unlinkSync(LOCKFILE_PATH);
  });

  it("acquires then releases the lockfile", () => {
    acquireLockfile();
    expect(existsSync(LOCKFILE_PATH)).toBe(true);
    releaseLockfile();
    expect(existsSync(LOCKFILE_PATH)).toBe(false);
  });

  it("refuses a second acquire when the held PID is still alive", () => {
    acquireLockfile();
    expect(() => acquireLockfile()).toThrow(/already running/i);
  });

  it("steals the lockfile when the held PID is dead", () => {
    writeFileSync(LOCKFILE_PATH, "999999"); // PID unlikely to exist
    expect(() => acquireLockfile()).not.toThrow();
    expect(existsSync(LOCKFILE_PATH)).toBe(true);
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

```bash
cd /Users/student/Documents/accelerate-avians && npx vitest run scripts/load-test.test.ts
```

- [ ] **Step 4: Implement wrapper**

Create `scripts/load-test.ts`:

```ts
import { existsSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { URL } from "node:url";

export const LOCKFILE_PATH = "/tmp/aa-loadtest.lock";
export const MAX_DURATION_MINUTES = 5;

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

/** Refuses non-localhost targets unless ALLOW_NON_LOCAL=1 is set. */
export function assertLocalhostTarget(target: string): void {
  const url = new URL(target);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (LOCAL_HOSTNAMES.has(host)) return;
  if (process.env.ALLOW_NON_LOCAL === "1") return;
  throw new Error(
    `Load test refused: TARGET_URL resolves to non-local hostname "${host}". ` +
      `Set ALLOW_NON_LOCAL=1 to bypass (production is still forbidden by policy).`
  );
}

/** Creates a PID-stamped lockfile. Throws if another live PID holds it. Steals dead locks. */
export function acquireLockfile(): void {
  if (existsSync(LOCKFILE_PATH)) {
    const heldPidStr = readFileSync(LOCKFILE_PATH, "utf8").trim();
    const heldPid = Number(heldPidStr);
    if (Number.isFinite(heldPid) && heldPid > 0) {
      try {
        process.kill(heldPid, 0); // signal 0 = existence check
        throw new Error(`Load test already running under PID ${heldPid}`);
      } catch (err) {
        if (err instanceof Error && /ESRCH/.test(String((err as NodeJS.ErrnoException).code))) {
          // stale lock — proceed to overwrite
        } else {
          throw err;
        }
      }
    }
  }
  writeFileSync(LOCKFILE_PATH, String(process.pid));
}

export function releaseLockfile(): void {
  if (existsSync(LOCKFILE_PATH)) unlinkSync(LOCKFILE_PATH);
}

export interface RunOptions {
  target: string;
  scenario: string; // path to k6 scenario script
  outputJson: string;
  k6Args?: string[];
}

/** Invokes k6 with the 5-minute cap + JSON output, streaming stdout live. */
export function runScenario(opts: RunOptions): { status: number; stdout: string } {
  const result = spawnSync(
    "k6",
    [
      "run",
      "--duration",
      `${MAX_DURATION_MINUTES}m`,
      "--out",
      `json=${opts.outputJson}`,
      "--env",
      `TARGET_URL=${opts.target}`,
      ...(opts.k6Args ?? []),
      opts.scenario,
    ],
    { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] }
  );
  return { status: result.status ?? 1, stdout: result.stdout ?? "" };
}

/** Top-level CLI entry point. Run as `npx tsx scripts/load-test.ts <scenario>`. */
async function main() {
  const target = process.env.TARGET_URL ?? "ws://localhost:3001";
  const scenarioArg = process.argv[2];
  if (!scenarioArg) {
    console.error("Usage: npx tsx scripts/load-test.ts <scenario-name>");
    console.error("Scenarios: broadcast-fanout, db-finalize, rate-limiter, reconnect-storm, slow-consumer");
    process.exit(2);
  }

  assertLocalhostTarget(target);
  acquireLockfile();
  try {
    const result = runScenario({
      target,
      scenario: `scripts/load-test/${scenarioArg}.js`,
      outputJson: `scripts/load-test/results/${scenarioArg}-${Date.now()}.json`,
    });
    process.exit(result.status);
  } finally {
    releaseLockfile();
  }
}

// Guard against being imported by the test file.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    releaseLockfile();
    process.exit(1);
  });
}
```

- [ ] **Step 5: Verify tests pass**

```bash
cd /Users/student/Documents/accelerate-avians && npx vitest run scripts/load-test.test.ts
```
Expected: 6/6 PASS. (3 for `assertLocalhostTarget`, 3 for lockfile.)

- [ ] **Step 6: Add `npm run load-test` to `package.json`**

In the `scripts` block of the root `package.json`, add:

```json
"load-test": "tsx scripts/load-test.ts"
```

So `npm run load-test -- broadcast-fanout` is the invocation.

- [ ] **Step 7: Commit**

```bash
git add scripts/load-test.ts scripts/load-test.test.ts package.json
git commit -m "feat(load-test): wrapper with localhost allowlist + PID-checked lockfile"
```

---

## Task 2: Broadcast-fanout scenario (headline latency number)

**Files:**
- Create: `scripts/load-test/lib/common.js`
- Create: `scripts/load-test/broadcast-fanout.js`
- Create: `scripts/load-test/results/.gitkeep`

- [ ] **Step 1: Shared helper — k6 WebSocket client factory**

Create `scripts/load-test/lib/common.js`:

```js
import ws from "k6/ws";
import { Trend, Counter } from "k6/metrics";

export const broadcastLatency = new Trend("broadcast_latency_ms");
export const droppedMessages = new Counter("dropped_messages");

/** Build a virtual typing race. Returns a connection handle that emits progress until done. */
export function openRaceClient(url, roomCode, userId, onReceive) {
  ws.connect(url, {}, function (socket) {
    socket.on("open", () => {
      socket.send(JSON.stringify({ event: "join-room", roomCode, userId }));
    });
    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw);
        onReceive(socket, msg);
      } catch { /* skip non-JSON frames */ }
    });
    socket.setTimeout(() => socket.close(), 60_000);
  });
}
```

Note: Socket.IO's wire protocol isn't raw JSON — k6 connects at the WebSocket layer, which means we either send/receive the engine.io framing directly or use the built-in `connectionStateRecovery`-less upgrade. For the purposes of the load test we bypass Socket.IO's framing by hitting a **test-only** `/loadtest` endpoint that accepts raw JSON. See Task 2 Step 3.

- [ ] **Step 2: Add `/loadtest` raw-WebSocket endpoint to the server**

In `server/src/index.ts`, gated by `process.env.LOADTEST_ENDPOINT === "1"` so the endpoint is DISABLED by default and cannot be accidentally hit in prod, add:

```ts
if (process.env.LOADTEST_ENDPOINT === "1") {
  const { WebSocketServer } = await import("ws");
  const loadtestWss = new WebSocketServer({ noServer: true });
  httpServer.on("upgrade", (req, socket, head) => {
    if (new URL(req.url ?? "", "http://x").pathname === "/loadtest") {
      loadtestWss.handleUpgrade(req, socket as never, head, (ws) => {
        loadtestWss.emit("connection", ws, req);
      });
    }
  });
  loadtestWss.on("connection", (ws) => {
    // minimal echo + broadcast replay for k6 scenarios; each message is JSON
    // with a `kind` field. See docs/netcode.md § Load test for protocol.
    ws.on("message", (raw) => {
      // ... echo protocol: see Task 2 Step 3
    });
  });
}
```

Alternative if the `/loadtest` raw endpoint is disproportionate for the Phase 3 scope: use the `socket.io-client` npm module inside k6 via a bundled script. This is technically supported via k6's built-in JS runtime bundler if `socket.io-client` is built as UMD. Spike this first — if bundling works in ~30 min, skip the `/loadtest` endpoint entirely.

**Decision:** pick one of the two paths and document why. The `/loadtest` endpoint is more controlled; the `socket.io-client` bundle is more honest (tests the real protocol). If the bundle works, prefer it.

- [ ] **Step 3: Define the load-test protocol**

Whichever path chosen, the scenario needs these messages:
- `join-room { roomCode, userId }` → server ack `joined-room`
- `typing-progress { charIndex }` → server broadcasts `player-progress`
- `player-finished { ghostData, correctKeystrokes, totalKeystrokes }` → server ack `race-complete`

For the `/loadtest` endpoint, implement minimal versions that call through to the same `RoomManager` + `RaceController` instances. For the `socket.io-client` path, the real handlers run.

- [ ] **Step 4: Write the broadcast-fanout scenario**

Create `scripts/load-test/broadcast-fanout.js`:

```js
import ws from "k6/ws";
import { check, group, sleep } from "k6";
import { broadcastLatency } from "./lib/common.js";

export const options = {
  scenarios: {
    fanout_50: { executor: "per-vu-iterations", vus: 200, iterations: 1, exec: "runRace", gracefulStop: "5s", env: { ROOM_COUNT: "50" } },
    fanout_100: { executor: "per-vu-iterations", vus: 400, iterations: 1, exec: "runRace", gracefulStop: "5s", startTime: "90s", env: { ROOM_COUNT: "100" } },
    fanout_200: { executor: "per-vu-iterations", vus: 800, iterations: 1, exec: "runRace", gracefulStop: "5s", startTime: "180s", env: { ROOM_COUNT: "200" } },
    fanout_400: { executor: "per-vu-iterations", vus: 1600, iterations: 1, exec: "runRace", gracefulStop: "5s", startTime: "270s", env: { ROOM_COUNT: "400" } },
  },
  thresholds: {
    "broadcast_latency_ms": ["p(99)<100"], // informational — report, don't hard-fail
  },
};

export function runRace() {
  const target = __ENV.TARGET_URL || "ws://localhost:3001";
  const roomCode = `LT-${__VU % Number(__ENV.ROOM_COUNT)}`;
  const userId = `vu-${__VU}`;

  const res = ws.connect(`${target}/loadtest`, {}, function (socket) {
    const sendTimes = new Map();

    socket.on("open", () => {
      socket.send(JSON.stringify({ kind: "join-room", roomCode, userId }));
    });

    socket.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if (msg.kind === "player-progress" && msg.userId !== userId) {
        const t = sendTimes.get(`${msg.userId}:${msg.charIndex}`);
        if (t !== undefined) {
          broadcastLatency.add(Date.now() - t);
          sendTimes.delete(`${msg.userId}:${msg.charIndex}`);
        }
      }
    });

    // Emit 60s of progress at 8Hz
    const ticker = setInterval(() => {
      const charIndex = Math.floor((Date.now() - __ITER_START) / 15);
      sendTimes.set(`${userId}:${charIndex}`, Date.now());
      socket.send(JSON.stringify({ kind: "typing-progress", charIndex }));
    }, 125);

    socket.setTimeout(() => {
      clearInterval(ticker);
      socket.close();
    }, 60_000);
  });

  check(res, { "connected": (r) => r && r.status === 101 });
}
```

- [ ] **Step 5: Smoke-run at 50 rooms**

In one terminal:
```bash
cd /Users/student/Documents/accelerate-avians/server && LOADTEST_ENDPOINT=1 RESUME_TOKEN_SECRET=$(openssl rand -hex 32) npm run dev
```

In another:
```bash
cd /Users/student/Documents/accelerate-avians && npm run load-test -- broadcast-fanout
```

The first scenario (50 rooms × 4 VUs = 200 VUs) should complete in ~90s.

Inspect the k6 summary. Record:
- `broadcast_latency_ms` p50, p95, p99
- any dropped messages / connection failures
- server CPU + RSS (visible in `top` or `Activity Monitor`)

- [ ] **Step 6: Commit (scenario file only — results are gitignored)**

```bash
echo "scripts/load-test/results/*.json" >> .gitignore
git add scripts/load-test/broadcast-fanout.js scripts/load-test/lib/common.js scripts/load-test/results/.gitkeep server/src/index.ts .gitignore
git commit -m "feat(load-test): broadcast-fanout scenario + /loadtest endpoint"
```

---

## Task 3: DB-finalize scenario (Prisma pool stress)

**Files:**
- Create: `scripts/load-test/db-finalize.js`

- [ ] **Step 1: Design intent**

Spec § 2.5.3 says: 200 rooms finish within a 5-second window. Measures Prisma pool exhaustion + Postgres write contention. Pass/fail: p99 of DB write latency < 500ms.

The scenario sets up 200 rooms, advances each race quickly, then synchronizes all 200 `player-finished` emits within a 5-second window. The server's `race-handlers.ts:player-finished` does an `await prisma.match.findUnique(...)` + `await prisma.matchPlayer.updateMany(...)` — that's the DB path under pressure.

- [ ] **Step 2: Write the scenario**

Create `scripts/load-test/db-finalize.js`:

```js
import ws from "k6/ws";
import { check } from "k6";
import { Trend } from "k6/metrics";

const finalizeLatency = new Trend("db_finalize_ms");

export const options = {
  scenarios: {
    db_finalize: {
      executor: "shared-iterations",
      vus: 800,            // 200 rooms × 4 players
      iterations: 800,
      maxDuration: "2m",
    },
  },
  thresholds: {
    "db_finalize_ms": ["p(99)<500"],
  },
};

export default function () {
  const target = __ENV.TARGET_URL || "ws://localhost:3001";
  const roomCode = `DBFIN-${Math.floor(__VU / 4)}`;
  const userId = `vu-${__VU}`;

  ws.connect(`${target}/loadtest`, {}, function (socket) {
    socket.on("open", () => {
      socket.send(JSON.stringify({ kind: "join-room", roomCode, userId }));
    });
    socket.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if (msg.kind === "race-ready") {
        // send a synthetic finish within the 5s synchronization window
        const delay = Math.random() * 5000;
        socket.setTimeout(() => {
          const sent = Date.now();
          socket.send(JSON.stringify({
            kind: "player-finished",
            ghostData: [{ charIndex: 0, ms: 0 }, { charIndex: 50, ms: 5000 }],
            correctKeystrokes: 50,
            totalKeystrokes: 50,
          }));
          socket.on("message", (raw2) => {
            const m = JSON.parse(raw2);
            if (m.kind === "race-complete-ack" && m.userId === userId) {
              finalizeLatency.add(Date.now() - sent);
              socket.close();
            }
          });
        }, delay);
      }
    });
  });
}
```

- [ ] **Step 3: Run**

Server must be running with `LOADTEST_ENDPOINT=1`. Run:
```bash
npm run load-test -- db-finalize
```

Record: `db_finalize_ms` p50, p99. Pass threshold: p99 < 500 ms. If it fails, the bottleneck is likely Prisma connection pool (default 10). Document the finding in `docs/netcode.md`.

- [ ] **Step 4: Commit**

```bash
git add scripts/load-test/db-finalize.js
git commit -m "feat(load-test): db-finalize scenario — 200 rooms finish in 5s"
```

---

## Task 4: Rate-limiter scenario

**Files:**
- Create: `scripts/load-test/rate-limiter.js`

- [ ] **Step 1: Write the scenario**

Client sends 60 typing-progress events per second (exceeds the 30/sec `ProgressValidator` limit). Each client counts KICK-triggered disconnects and reports to a `kicks_within_1s` counter.

```js
import ws from "k6/ws";
import { Counter, Trend } from "k6/metrics";

const kicksWithin1s = new Counter("kicks_within_1s");
const kickLatency = new Trend("kick_latency_ms");

export const options = {
  scenarios: {
    rate_limit: {
      executor: "per-vu-iterations",
      vus: 20,
      iterations: 1,
    },
  },
  thresholds: {
    // every offending client must be kicked within 1s of first over-limit message
    "kicks_within_1s": ["count>=20"],
  },
};

export default function () {
  const target = __ENV.TARGET_URL || "ws://localhost:3001";
  const userId = `vu-${__VU}`;

  ws.connect(`${target}/loadtest`, {}, function (socket) {
    let firstOverlimitSend = null;

    socket.on("open", () => {
      socket.send(JSON.stringify({ kind: "join-room", roomCode: `RL-${__VU}`, userId }));
    });

    socket.on("close", () => {
      if (firstOverlimitSend !== null) {
        const elapsed = Date.now() - firstOverlimitSend;
        kickLatency.add(elapsed);
        if (elapsed < 1000) kicksWithin1s.add(1);
      }
    });

    // 60 Hz progress for 5s (60 × 5 = 300 messages, 10x the allowed rate)
    for (let i = 0; i < 300; i++) {
      socket.setTimeout(() => {
        if (i === 30) firstOverlimitSend = Date.now();
        socket.send(JSON.stringify({ kind: "typing-progress", charIndex: i }));
      }, i * 16);
    }

    socket.setTimeout(() => socket.close(), 10_000);
  });
}
```

- [ ] **Step 2: Run**

```bash
npm run load-test -- rate-limiter
```

Pass: every one of the 20 VUs was kicked within 1s of the first over-limit message. If kicks come late (e.g., 3s+), the `ProgressValidator` is not enforcing aggressively enough — record and note in writeup.

- [ ] **Step 3: Commit**

```bash
git add scripts/load-test/rate-limiter.js
git commit -m "feat(load-test): rate-limiter scenario — KICK within 1s"
```

---

## Task 5: Reconnect-storm scenario with RSS + FD probe

**Files:**
- Create: `scripts/load-test/reconnect-storm.js`
- Create: `scripts/load-test/sample-server-metrics.ts`

- [ ] **Step 1: Write the Node probe that samples RSS + FD**

Create `scripts/load-test/sample-server-metrics.ts`:

```ts
#!/usr/bin/env tsx
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const TARGET_PID = Number(process.argv[2]);
const OUTPUT_PATH = process.argv[3] || `scripts/load-test/results/metrics-${Date.now()}.ndjson`;
const SAMPLE_INTERVAL_MS = 2000;

if (!Number.isFinite(TARGET_PID)) {
  console.error("usage: sample-server-metrics.ts <pid> [output-path]");
  process.exit(2);
}

function sampleRss(pid: number): number | null {
  const out = spawnSync("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf8" });
  const kb = Number(out.stdout.trim());
  return Number.isFinite(kb) ? kb * 1024 : null;
}

function sampleFdCount(pid: number): number | null {
  // macOS: lsof -p PID | wc -l
  const out = spawnSync("bash", ["-lc", `lsof -p ${pid} 2>/dev/null | wc -l`], { encoding: "utf8" });
  const n = Number(out.stdout.trim());
  return Number.isFinite(n) ? n : null;
}

import { appendFileSync } from "node:fs";
let running = true;
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });

(async () => {
  while (running) {
    const ts = Date.now();
    const rss = sampleRss(TARGET_PID);
    const fd = sampleFdCount(TARGET_PID);
    if (rss === null && fd === null) break; // process went away
    appendFileSync(OUTPUT_PATH, JSON.stringify({ ts, rss, fd }) + "\n");
    await new Promise((r) => setTimeout(r, SAMPLE_INTERVAL_MS));
  }
  console.log(`wrote metrics to ${OUTPUT_PATH}`);
})();
```

- [ ] **Step 2: Write the reconnect-storm scenario**

Create `scripts/load-test/reconnect-storm.js`:

```js
import ws from "k6/ws";

export const options = {
  scenarios: {
    reconnect_storm: {
      executor: "per-vu-iterations",
      vus: 50,
      iterations: 1,
    },
  },
};

export default function () {
  const target = __ENV.TARGET_URL || "ws://localhost:3001";
  const userId = `vu-${__VU}`;

  // First: join, get token.
  let token;
  ws.connect(`${target}/loadtest`, {}, function (socket) {
    socket.on("open", () => {
      socket.send(JSON.stringify({ kind: "join-room", roomCode: `RC-${__VU}`, userId }));
    });
    socket.on("message", (raw) => {
      const m = JSON.parse(raw);
      if (m.kind === "resume-token") { token = m.token; socket.close(); }
    });
    socket.setTimeout(() => socket.close(), 5_000);
  });

  // Then: simulated disconnect, then 50 simultaneous reconnects across all VUs.
  // k6's shared-iterations gate can synchronize the reconnect burst.
  ws.connect(`${target}/loadtest`, {}, function (socket) {
    socket.on("open", () => {
      socket.send(JSON.stringify({ kind: "reconnect", token }));
    });
    socket.setTimeout(() => socket.close(), 5_000);
  });
}
```

- [ ] **Step 3: Run coordinated with the RSS/FD probe**

```bash
# terminal 1: start server, capture PID
cd /Users/student/Documents/accelerate-avians/server
LOADTEST_ENDPOINT=1 RESUME_TOKEN_SECRET=$(openssl rand -hex 32) npm run dev &
SERVER_PID=$!
echo "server PID: $SERVER_PID"

# terminal 2: start probe
cd /Users/student/Documents/accelerate-avians
npx tsx scripts/load-test/sample-server-metrics.ts $SERVER_PID scripts/load-test/results/reconnect-storm-metrics.ndjson &
PROBE_PID=$!

# terminal 3: run scenario
npm run load-test -- reconnect-storm

# cleanup
kill $PROBE_PID
kill $SERVER_PID
```

Record RSS delta before/after + max FD count. Pass thresholds per spec § 2.5.3: RSS growth < 5 MB, FD growth < 200.

- [ ] **Step 4: Commit**

```bash
git add scripts/load-test/reconnect-storm.js scripts/load-test/sample-server-metrics.ts
git commit -m "feat(load-test): reconnect-storm scenario with RSS+FD probe"
```

---

## Task 6: Slow-consumer scenario

**Files:**
- Create: `scripts/load-test/slow-consumer.js`

- [ ] **Step 1: Write the scenario**

One VU per room, artificially slow — reads messages on a 5-second throttle — while the server broadcasts at 10Hz. The server's `SlowConsumerSampler` (Phase 2 P2-8) should detect >64KB buffered for 2 consecutive 2-second samples and disconnect with reason `"buffer-overflow"`. Verify the disconnect reason within ~4 seconds.

```js
import ws from "k6/ws";
import { Counter, Trend } from "k6/metrics";

const bufferOverflowDisconnects = new Counter("buffer_overflow_disconnects");
const disconnectLatency = new Trend("disconnect_latency_ms");

export const options = {
  scenarios: { slow: { executor: "per-vu-iterations", vus: 10, iterations: 1 } },
  thresholds: {
    "buffer_overflow_disconnects": ["count>=10"],
  },
};

export default function () {
  const target = __ENV.TARGET_URL || "ws://localhost:3001";
  const start = Date.now();

  ws.connect(`${target}/loadtest`, {}, function (socket) {
    socket.on("open", () => {
      socket.send(JSON.stringify({ kind: "join-room", roomCode: `SC-${__VU}`, userId: `vu-${__VU}` }));
      // Simulate slow consumer: do nothing in message handler except count.
      // Server should start broadcasting player-progress, buffer will grow on our socket.
    });
    // Don't read messages aggressively — k6 ws buffers frames internally.
    // The server-side buffer on the transport.writable is what the SlowConsumerSampler watches.
    socket.on("close", (code, reason) => {
      if (String(reason) === "buffer-overflow") {
        bufferOverflowDisconnects.add(1);
        disconnectLatency.add(Date.now() - start);
      }
    });
    socket.setTimeout(() => socket.close(), 8_000);
  });
}
```

- [ ] **Step 2: Design caveat**

k6's WebSocket client drains frames as fast as they arrive (internal buffer). To actually slow the client-side read, we'd need a socket-level throttle. **The honest thing for Phase 3 is to acknowledge this limitation in `docs/netcode.md` and use a direct Node-level test instead:**

Alternative (simpler, more honest): add a Vitest test in `server/tests/integration/slow-consumer.test.ts` that:
- Uses `ws` npm module (already a transitive dep via Socket.IO)
- Connects, pauses read by not draining the internal buffer
- Waits 4s
- Asserts close reason === "buffer-overflow"

Prefer this path. The `k6` scenario remains as a nominal stressor; the Vitest proves the contract.

- [ ] **Step 3: Write the Vitest alternative**

Create `server/tests/integration/slow-consumer.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import { Server as IOServer } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { SlowConsumerSampler } from "../../src/handlers/connection-handler.js";

describe.skipIf(!process.env.SLOW_CONSUMER_TEST)("SlowConsumerSampler under real WebSocket", () => {
  // This test is gated behind an env flag because it uses real network + timers.
  // Run with: SLOW_CONSUMER_TEST=1 npx vitest run tests/integration/slow-consumer.test.ts
  //
  // The test is INTENTIONALLY excluded from the default suite to keep CI fast.
  // Phase 3 uses it as evidence of the buffer-overflow contract at the transport layer.
  // ... (test body omitted; flesh out if time permits)
});
```

Mark as a DONE_WITH_CONCERNS step — the Vitest path is correct but requires meaningful network setup. If time is tight, skip the actual network test and document the k6 scenario's limitation in the writeup.

- [ ] **Step 4: Commit what you have**

```bash
git add scripts/load-test/slow-consumer.js server/tests/integration/slow-consumer.test.ts
git commit -m "feat(load-test): slow-consumer scenario with Vitest fallback doc"
```

---

## Task 7: Run the full sweep and collect results

- [ ] **Step 1: Start the server with load-test endpoint enabled**

```bash
cd /Users/student/Documents/accelerate-avians/server
export RESUME_TOKEN_SECRET=$(openssl rand -hex 32)
LOADTEST_ENDPOINT=1 npm run dev &
SERVER_PID=$!
```

- [ ] **Step 2: Run each scenario in sequence**

```bash
cd /Users/student/Documents/accelerate-avians
npm run load-test -- broadcast-fanout
npm run load-test -- db-finalize
npm run load-test -- rate-limiter
# reconnect-storm requires the probe — see Task 5 Step 3
npm run load-test -- slow-consumer
```

Each run writes a timestamped JSON to `scripts/load-test/results/`.

- [ ] **Step 3: Kill the server cleanly**

```bash
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null
```

- [ ] **Step 4: Aggregate results**

Open each JSON and extract: `broadcast_latency_ms` p50/p99, `db_finalize_ms` p99, `kicks_within_1s` count, `buffer_overflow_disconnects` count, and the RSS/FD deltas from `reconnect-storm-metrics.ndjson`.

- [ ] **Step 5: Record environment**

Record: macOS version (`sw_vers`), Node version (`node -v`), Postgres version (`psql $DATABASE_URL -c 'SELECT version()'`), k6 version (`k6 version`), machine CPU + RAM (`sysctl -n hw.ncpu hw.memsize`).

---

## Task 8: Write `docs/netcode.md`

**File:**
- Create: `docs/netcode.md`

- [ ] **Step 1: Draft the writeup**

Structure per spec § 4.3:

```markdown
# Accelerate Avians — Netcode

1. Problem statement
2. Server-authoritative scoring — how Phase 1 demoted client ghostData
3. Entity interpolation — timeline diagram + dropped-packet + cold-start cases
4. Clock sync — EMA math + median-of-5 handshake rationale
5. Anti-cheat (pending Phase 4) — noted as LOG-only until corpus calibration
6. Reconnection protocol — sequence diagram including socket-fencing + atomic epoch
7. Load test — methodology + environment + per-scenario table
8. Trade-offs considered (and rejected) — per spec § 4.3 item 8
9. Secrets & config — env vars required (RESUME_TOKEN_SECRET, DATABASE_URL, Clerk keys)
```

- [ ] **Step 2: Fill in the load-test table from Task 7 results**

```markdown
## Load test results

**Environment:** macOS 15.x, Node 20.x, Postgres 16.x, k6 v0.5x.x. Machine: Apple Silicon M<x>, 16 GB RAM. All runs on loopback (localhost) — **not** representative of real internet latency.

| Scenario | Measurement | p50 | p99 | Pass/Fail |
|----------|-------------|-----|-----|-----------|
| `broadcast-fanout` | end-to-end progress latency @ 50 rooms | {X ms} | {Y ms} | — |
| `broadcast-fanout` | end-to-end progress latency @ 100 rooms | … | … | — |
| `broadcast-fanout` | end-to-end progress latency @ 200 rooms | … | … | — |
| `broadcast-fanout` | end-to-end progress latency @ 400 rooms | … | … | — |
| `db-finalize` | DB write latency under 200-room burst | … | … | < 500 ms ≡ pass/fail |
| `rate-limiter` | KICK fires within 1s of first over-limit msg | — | — | 20/20 ≡ pass |
| `reconnect-storm` | RSS delta across 50 reconnects | — | — | < 5 MB ≡ pass |
| `reconnect-storm` | FD delta | — | — | < 200 ≡ pass |
| `slow-consumer` | buffer-overflow disconnect fires within 4s | — | — | 10/10 ≡ pass |
```

- [ ] **Step 3: Commit**

```bash
git add docs/netcode.md
git commit -m "docs(netcode): Phase 3 load-test results + trade-offs writeup"
```

---

## Task 9: Update README + fill resume-bullet placeholders

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-04-16-netcode-and-polish-design.md` (fill § 4.1 placeholders with measured values)

- [ ] **Step 1: Add a netcode-links section to README**

Append:

```markdown
## Netcode writeup

For a deep dive on how multiplayer scoring, reconnection, and interpolation work — including measured latency tables and a load-test methodology — see [docs/netcode.md](docs/netcode.md).

Capacity (measured in load test; not hosted capacity): ~{N} concurrent rooms on a single-host localhost run before p99 broadcast latency exceeds {X} ms. Hosted on Railway hobby tier + Vercel hobby; a paid Railway plan may be required for sustained loads at the top end.
```

- [ ] **Step 2: Fill in `{N}` and `{X}` in the spec's § 4.1 resume-bullet variant**

Replace the placeholders in `docs/superpowers/specs/2026-04-16-netcode-and-polish-design.md` with the measured numbers from `docs/netcode.md`.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/specs/2026-04-16-netcode-and-polish-design.md
git commit -m "docs: fill resume-bullet placeholders with Phase 3 measured numbers"
```

---

## Task 10: Tag + finish branch

- [ ] **Step 1: Run full suite**

```bash
cd /Users/student/Documents/accelerate-avians/server && npx vitest run   # still 154
cd /Users/student/Documents/accelerate-avians && npx vitest run scripts/load-test.test.ts   # 6 pass
```

- [ ] **Step 2: Tag**

```bash
git tag -a phase-3-load-test -m "Phase 3 complete: load test + netcode writeup + measured resume bullet"
```

- [ ] **Step 3: Invoke superpowers:finishing-a-development-branch**

---

## Spec coverage

| Spec section | Task(s) |
|---|---|
| § 2.5.1 safety guards | 1 |
| § 2.5.2 methodology | 1, 7 |
| § 2.5.3 scenarios (all 5) | 2, 3, 4, 5, 6 |
| § 2.5.4 adapter caveat | 8 (documented in writeup) |
| § 2.5.5 output | 7, 8 |
| § 4.1 resume-bullet finalization | 9 |
| § 4.3 docs/netcode.md structure | 8 |
| § 8.1 load test safety | 1 |

## Explicit non-goals

- ❌ Multi-host load testing (spec is explicit: loopback only)
- ❌ Real internet latency injection (documented as out-of-scope; would use `tc/netem` in a future pass)
- ❌ Redis adapter test (single-instance deploy; documented as scaling ceiling)
- ❌ Public dashboard of live metrics (Phase 5-ish; out of Phase 3 scope)

## Notes for the implementer

- **If brew install k6 fails**, grab the macOS binary from https://k6.io/docs/get-started/installation/ and put it on `PATH`.
- **The `/loadtest` endpoint is gated behind `LOADTEST_ENDPOINT=1`**. Never start a prod server with that env set. The README should say so.
- **Results JSON files are gitignored** — commit only the scenario scripts and the summary markdown.
- **Numbers will be measured, not predicted.** If p99 at 400 rooms is 80 ms, the bullet should honestly say that — the whole point is a defensible claim.
- **Slow-consumer Vitest gating** — if the network test proves hard to write reliably, document the limitation and let the k6 scenario stand as nominal stressor. Honest is better than brittle.
