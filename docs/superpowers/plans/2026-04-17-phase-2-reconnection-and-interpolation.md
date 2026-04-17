# Phase 2 — Reconnection, Opponent Interpolation, Clock Sync

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make multiplayer races tolerate brief disconnects (15–20 s reconnect window) and render opponent birds smoothly via client-side entity interpolation with explicit server clock sync.

**Architecture:** Server adds a `serverTime` stamp to every broadcast and exposes a 5-round `time-sync` handshake at room-join. The client maintains an EMA-smoothed clock offset and renders each opponent from a FIFO sample buffer `INTERP_DELAY_MS = 200 ms` behind server time. On reconnect, the server re-authenticates via Clerk + verifies an HMAC-signed `resumeToken` (carrying `userId`, `roomCode`, `sessionEpoch`, `sessionId`, `issuedAt`), synchronously fences the old socket with `disconnect(true)`, and sends a full snapshot of every player's `charIndex` + `isConnected` for clean interpolator reseed.

**Tech Stack:** Express + Socket.IO + Node 20 TypeScript + Vitest (server), Next.js 16 + React 19 (client), Prisma 5 / PostgreSQL.

**Spec sections:** § 2.2 (interpolation), § 2.3 (reconnection), § 2.4 (transport & ping) of `docs/superpowers/specs/2026-04-16-netcode-and-polish-design.md`.

**Dependencies:** Phase 1 (merged at `887a375`). `Score.serverGhost`, `Score.flagged`, and the `clientGhostData` renames already exist.

---

## File Structure

Files created or modified in Phase 2:

| Path | Change | Responsibility |
|------|--------|----------------|
| `server/src/lib/resume-token.ts` | **new** | HMAC mint + verify with `sessionId` + `issuedAt` |
| `server/src/lib/clock-broadcast.ts` | **new** | Attach `serverTime` to every emit; handle time-sync handshake (median-of-5, rate-limited) |
| `server/src/rooms/room-manager.ts` | modify | Atomic epoch increment via `jsonb_set` SQL; preserve disconnected state for 20s |
| `server/src/handlers/connection-handler.ts` | modify | 20s reconnect window, synchronous fence via `socket.disconnect(true)`, full-snapshot resume, pingInterval/pingTimeout + `perMessageDeflate: false` + `maxHttpBufferSize: 16384`, slow-consumer disconnect |
| `server/src/handlers/race-handlers.ts` | modify | Emit `serverTime` on broadcasts; accept `time-sync` event |
| `server/src/index.ts` | modify | Wire transport/ping config on Socket.IO server; fail boot if `RESUME_TOKEN_SECRET` missing |
| `prisma/schema.prisma` + `server/prisma/schema.prisma` | modify | Add `Match.epochs Json @default("{}")` |
| `prisma/migrations/<ts>_match_epochs/migration.sql` | **new** | Add `epochs jsonb` column on `matches` with default `'{}'` |
| `src/lib/clock-sync.ts` | **new** | Client EMA offset estimator + cold-start handshake |
| `src/hooks/useInterpolatedProgress.ts` | **new** | Opponent-progress interpolation w/ warmup (350 ms) vs steady (200 ms) buffer + 150 ms extrapolation + freeze |
| `src/components/OpponentBird.tsx` | modify | Render interpolated progress; freeze pose when sample-less or disconnected |
| `src/hooks/useMultiplayerRace.ts` | modify | Wire `time-sync` + reconnection flow; consume `resume_state` snapshot |
| `.env.example` | modify | Add `RESUME_TOKEN_SECRET` placeholder with regeneration comment |
| Tests: `server/src/lib/resume-token.test.ts`, `server/src/lib/clock-broadcast.test.ts`, `server/tests/integration/reconnect.test.ts`, `src/lib/clock-sync.test.ts`, `src/hooks/useInterpolatedProgress.test.ts` | **new** | Coverage per § 5 of the spec |

---

## Task 1: `RESUME_TOKEN_SECRET` env + `resume-token.ts` HMAC mint/verify

**Files:**
- Create: `server/src/lib/resume-token.ts`
- Test: `server/src/lib/resume-token.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Update `.env.example`**

Append:
```
# Required for resume-token HMAC (reconnection protocol).
# Generate fresh value with:  openssl rand -hex 32
RESUME_TOKEN_SECRET=replace-with-32-byte-hex
```

- [ ] **Step 2: Write the failing test**

Create `server/src/lib/resume-token.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mintResumeToken, verifyResumeToken, RESUME_WINDOW_MS } from "./resume-token.js";

const SECRET = "a".repeat(64);

describe("resume-token", () => {
  it("round-trips a valid token", () => {
    const payload = { userId: "u1", roomCode: "ROOM1", sessionEpoch: 1, sessionId: "n1" };
    const token = mintResumeToken(SECRET, payload);
    const result = verifyResumeToken(SECRET, token);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.payload).toMatchObject(payload);
  });

  it("rejects a tampered token", () => {
    const token = mintResumeToken(SECRET, { userId: "u1", roomCode: "R", sessionEpoch: 1, sessionId: "n" });
    const tampered = token.slice(0, -2) + "xx";
    const result = verifyResumeToken(SECRET, tampered);
    expect(result.valid).toBe(false);
  });

  it("rejects a token issued past RESUME_WINDOW_MS + grace", () => {
    const payload = { userId: "u1", roomCode: "R", sessionEpoch: 1, sessionId: "n" };
    const oldIssuedAt = Date.now() - RESUME_WINDOW_MS - 60_000; // 60s past grace
    const token = mintResumeToken(SECRET, payload, oldIssuedAt);
    const result = verifyResumeToken(SECRET, token);
    expect(result.valid).toBe(false);
  });

  it("rejects tokens signed with a different secret", () => {
    const token = mintResumeToken(SECRET, { userId: "u1", roomCode: "R", sessionEpoch: 1, sessionId: "n" });
    const result = verifyResumeToken("b".repeat(64), token);
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

`cd server && npx vitest run src/lib/resume-token.test.ts` — expect FAIL, module not found.

- [ ] **Step 4: Implement `resume-token.ts`**

Create `server/src/lib/resume-token.ts`:
```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const RESUME_WINDOW_MS = 20_000;
const GRACE_MS = 30_000;

export interface ResumeTokenPayload {
  userId: string;
  roomCode: string;
  sessionEpoch: number;
  sessionId: string;
}

interface SignedPayload extends ResumeTokenPayload {
  issuedAt: number;
}

type VerifyResult =
  | { valid: true; payload: SignedPayload }
  | { valid: false; reason: string };

export function mintResumeToken(
  secret: string,
  payload: ResumeTokenPayload,
  issuedAt: number = Date.now()
): string {
  const body: SignedPayload = { ...payload, issuedAt };
  const json = JSON.stringify(body);
  const sig = createHmac("sha256", secret).update(json).digest("hex");
  return Buffer.from(json).toString("base64url") + "." + sig;
}

export function verifyResumeToken(secret: string, token: string): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, reason: "malformed" };
  const [b64, sig] = parts;
  let json: string;
  try {
    json = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return { valid: false, reason: "malformed" };
  }
  const expectedSig = createHmac("sha256", secret).update(json).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expectedSig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "bad-signature" };
  }
  let body: SignedPayload;
  try {
    body = JSON.parse(json);
  } catch {
    return { valid: false, reason: "malformed" };
  }
  if (Date.now() - body.issuedAt > RESUME_WINDOW_MS + GRACE_MS) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, payload: body };
}

export function readSecretFromEnv(): string {
  const v = process.env.RESUME_TOKEN_SECRET;
  if (!v || v.length < 32) {
    throw new Error(
      "RESUME_TOKEN_SECRET env var missing or shorter than 32 bytes. Generate with: openssl rand -hex 32"
    );
  }
  return v;
}
```

- [ ] **Step 5: Verify tests pass**

`cd server && npx vitest run src/lib/resume-token.test.ts` — expect all 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/lib/resume-token.ts server/src/lib/resume-token.test.ts .env.example
git commit -m "feat(reconnect): HMAC resume-token mint + verify with expiry"
```

---

## Task 2: Server boot fails without `RESUME_TOKEN_SECRET`

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Inspect the current boot**

Read `server/src/index.ts` — find where the server starts listening.

- [ ] **Step 2: Add the secret check early**

Near the top of the file (after imports, before server wiring), add:
```ts
import { readSecretFromEnv } from "./lib/resume-token.js";

// Validate required secrets before binding port.
const RESUME_TOKEN_SECRET = readSecretFromEnv();
```

If other `readEnv`-style validation already exists, follow its pattern; otherwise this one line is sufficient. `RESUME_TOKEN_SECRET` should be passed to the reconnect handler later (Task 7) — for now it's enough that boot fails fast when missing.

- [ ] **Step 3: Verify**

Run `cd server && RESUME_TOKEN_SECRET= npm run dev` — expect immediate exit with the "RESUME_TOKEN_SECRET env var missing" error.

Run with a valid value (in your local .env or ad-hoc) — expect normal boot.

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(server): fail boot if RESUME_TOKEN_SECRET missing"
```

---

## Task 3: `Match.epochs` schema + migration

**Files:**
- Modify: `prisma/schema.prisma`, `server/prisma/schema.prisma`
- New: `prisma/migrations/<ts>_match_epochs/migration.sql`

- [ ] **Step 1: Add the column to both Prisma schemas**

In the `Match` model in both `prisma/schema.prisma` and `server/prisma/schema.prisma`, add:
```prisma
epochs Json @default("{}")
```

- [ ] **Step 2: Generate the migration**

`cd /Users/student/Documents/accelerate-avians && npx prisma migrate dev --name match_epochs`

If Prisma tries to do this as a destructive change, hand-write the SQL file instead:
```sql
ALTER TABLE "matches" ADD COLUMN "epochs" jsonb NOT NULL DEFAULT '{}'::jsonb;
```

- [ ] **Step 3: Regenerate the server Prisma client**

`cd server && npx prisma generate`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations server/prisma/schema.prisma
git commit -m "feat(db): add Match.epochs for per-player session-epoch tracking"
```

---

## Task 4: Atomic epoch increment on `Match.epochs`

**Files:**
- Modify: `server/src/rooms/room-manager.ts`
- Test: `server/src/rooms/room-manager.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `room-manager.test.ts` (or create a companion test if the existing file doesn't cover DB interactions):
```ts
it("incrementEpoch returns the new epoch atomically (jsonb_set)", async () => {
  // Seed a match row with epochs = {}
  const match = await prisma.match.create({ data: { roomCode: "ATOMIC1", passageId: /* ... */, status: "racing" } });
  const first = await roomManager.incrementEpoch(match.id, "alice");
  const second = await roomManager.incrementEpoch(match.id, "alice");
  expect(first).toBe(1);
  expect(second).toBe(2);
  const bobFirst = await roomManager.incrementEpoch(match.id, "bob");
  expect(bobFirst).toBe(1); // bob's key independent
});
```

Or, if the existing room-manager tests don't reach the DB, write a dedicated `server/tests/integration/match-epochs.test.ts` following `room-lifecycle.test.ts` style.

- [ ] **Step 2: Run it to fail**

`cd server && npx vitest run [your-test-file]` — expect FAIL, `roomManager.incrementEpoch is not a function`.

- [ ] **Step 3: Implement `incrementEpoch`**

Add to `RoomManager`:
```ts
import { prisma } from "../lib/prisma.js";

async incrementEpoch(matchId: string, userId: string): Promise<number> {
  // Single-statement atomic increment: no read-modify-write race window.
  const rows = await prisma.$queryRaw<{ new_epoch: string }[]>`
    UPDATE "matches"
    SET epochs = jsonb_set(
      COALESCE(epochs, '{}'::jsonb),
      ARRAY[${userId}],
      to_jsonb(COALESCE((epochs->>${userId})::int, 0) + 1)
    )
    WHERE id = ${matchId}
    RETURNING epochs->>${userId} AS new_epoch
  `;
  if (rows.length === 0) throw new Error(`Match ${matchId} not found`);
  return Number(rows[0].new_epoch);
}
```

- [ ] **Step 4: Verify the test passes**

`cd server && npx vitest run [your-test-file]` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/room-manager.ts server/src/rooms/room-manager.test.ts server/tests/integration/match-epochs.test.ts
git commit -m "feat(rooms): atomic epoch increment via jsonb_set"
```

---

## Task 5: `clock-broadcast.ts` — serverTime on emits + time-sync handshake

**Files:**
- Create: `server/src/lib/clock-broadcast.ts`
- Test: `server/src/lib/clock-broadcast.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { emitWithServerTime, TimeSyncTracker } from "./clock-broadcast.js";

describe("clock-broadcast", () => {
  it("emitWithServerTime attaches performance.now() as serverTime", () => {
    const socket = { emit: vi.fn() };
    emitWithServerTime(socket as any, "player-progress", { players: [] });
    const [eventName, payload] = socket.emit.mock.calls[0];
    expect(eventName).toBe("player-progress");
    expect(typeof payload.serverTime).toBe("number");
    expect(payload.players).toEqual([]);
  });

  it("TimeSyncTracker allows only one handshake per socket lifetime", () => {
    const t = new TimeSyncTracker();
    expect(t.allow("socket-1")).toBe(true);
    expect(t.allow("socket-1")).toBe(false);
    expect(t.allow("socket-2")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to fail.**

- [ ] **Step 3: Implement**

```ts
import type { Socket } from "socket.io";

export function emitWithServerTime<T extends object>(
  socket: Socket | { emit: (...args: unknown[]) => void },
  eventName: string,
  payload: T
): void {
  (socket as any).emit(eventName, { ...payload, serverTime: performance.now() });
}

export class TimeSyncTracker {
  private seen = new Set<string>();
  allow(socketId: string): boolean {
    if (this.seen.has(socketId)) return false;
    this.seen.add(socketId);
    return true;
  }
  release(socketId: string): void {
    this.seen.delete(socketId);
  }
}
```

- [ ] **Step 4: Verify tests pass.**

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/clock-broadcast.ts server/src/lib/clock-broadcast.test.ts
git commit -m "feat(sync): server-time stamping + time-sync rate limiter"
```

---

## Task 6: Wire Socket.IO transport + ping config

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Locate the `new Server(...)` call**

Read `server/src/index.ts`. Find where the Socket.IO server is instantiated.

- [ ] **Step 2: Set transport, ping, compression, and buffer limits**

Pass these options to the `new Server(...)` constructor (merge with any existing options):
```ts
{
  transports: ['websocket'],
  pingInterval: 5_000,
  pingTimeout: 8_000,
  perMessageDeflate: false,
  maxHttpBufferSize: 16_384,
}
```

- [ ] **Step 3: Verify server boots and existing tests still pass**

`cd server && npx vitest run` — all 140 tests still green.

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(transport): pin websocket, tune ping 5s/8s, disable deflate, cap frame 16KB"
```

---

## Task 7: Reconnection protocol — handler-level

**Files:**
- Modify: `server/src/handlers/connection-handler.ts`
- Test: `server/src/handlers/connection-handler.test.ts`

This task wires the full reconnect protocol from spec § 2.3. Keep it focused; it's the biggest task.

- [ ] **Step 1: Write 4 failing tests**

In `connection-handler.test.ts`, add (inside an existing or new `describe`):
```ts
it("on disconnect marks player isConnected=false and preserves seat", async () => { /* ... */ });
it("on reconnect with valid resumeToken fences the old socket synchronously (disconnect(true))", async () => { /* ... */ });
it("rejects reconnect with wrong sessionEpoch", async () => { /* ... */ });
it("resume_state includes every connected player's current charIndex + isConnected", async () => { /* ... */ });
```

Flesh out each test body using the existing mocking pattern in this file. Mock `mintResumeToken`/`verifyResumeToken`, `roomManager.incrementEpoch`, and `raceController.getProgressSnapshot`.

- [ ] **Step 2: Run all four — expect FAIL.**

- [ ] **Step 3: Implement the handler changes**

In `connection-handler.ts`:
- On `connection`, after Clerk auth, mint a `resumeToken` and emit `resume-token` to the new socket (for first-time join).
- Register a `reconnect` event handler that:
  1. Verifies Clerk token on the new socket.
  2. Calls `verifyResumeToken(secret, clientToken)`. Reject on invalid.
  3. Looks up the `(userId, roomCode)` slot in `roomManager`. Compares stored epoch; reject on mismatch.
  4. Synchronously: find the old socket for the same pair, call `oldSocket.disconnect(true)`, remove its seat binding from `roomManager` in the same tick.
  5. Calls `roomManager.incrementEpoch(matchId, userId)`; mints a new token from the returned epoch.
  6. Sends `resume_state` containing `{ charIndex, raceElapsedMs, comboCount, comboPaused, comboPausedAtCharIndex, players: [{ userId, charIndex, isConnected }...] }`.
- On `disconnect`, mark `player.isConnected = false`, start a 20 s timer, broadcast `player_disconnected`; at timeout, mark DNF via `raceController` + broadcast `player_dropped`.

Keep the code path small and well-commented. Use `RECONNECT_WINDOW_MS = 20_000`.

- [ ] **Step 4: Verify tests pass and full server suite green**

`cd server && npx vitest run` — all tests PASS, including the 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add server/src/handlers/connection-handler.ts server/src/handlers/connection-handler.test.ts
git commit -m "feat(reconnect): 20s window, synchronous fence, full snapshot resume"
```

---

## Task 8: Slow-consumer disconnect

**Files:**
- Modify: `server/src/handlers/connection-handler.ts`
- Test: `server/src/handlers/connection-handler.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("disconnects a socket whose outgoing buffer exceeds 64KB for two consecutive samples", async () => {
  const socket = makeFakeSocket();
  (socket as any).conn = { transport: { writable: { bufferedAmount: 70_000 } } };
  const sampler = new SlowConsumerSampler(socket as any);
  sampler.sample(); // first over threshold
  expect(socket.disconnect).not.toHaveBeenCalled();
  sampler.sample(); // second consecutive over threshold
  expect(socket.disconnect).toHaveBeenCalledWith("buffer-overflow");
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement `SlowConsumerSampler` in `connection-handler.ts`**

```ts
const SLOW_BUFFER_LIMIT_BYTES = 64 * 1024;

class SlowConsumerSampler {
  private consecutive = 0;
  constructor(private socket: Socket) {}
  sample(): void {
    const buffered = (this.socket as any).conn?.transport?.writable?.bufferedAmount ?? 0;
    if (buffered > SLOW_BUFFER_LIMIT_BYTES) {
      this.consecutive++;
      if (this.consecutive >= 2) this.socket.disconnect("buffer-overflow" as any);
    } else {
      this.consecutive = 0;
    }
  }
}
```

Install a `setInterval(..., 2000)` that calls `sample()` on every active socket; clear it on `disconnect`.

- [ ] **Step 4: Verify**

`cd server && npx vitest run src/handlers/connection-handler.test.ts` — passes.

- [ ] **Step 5: Commit**

```bash
git add server/src/handlers/connection-handler.ts server/src/handlers/connection-handler.test.ts
git commit -m "feat(transport): disconnect slow consumers (>64KB buffered for 2+ samples)"
```

---

## Task 9: Client clock-sync — EMA + median-of-5 cold start

**Files:**
- Create: `src/lib/clock-sync.ts`
- Test: `src/lib/clock-sync.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { ClockSync } from "@/lib/clock-sync";

describe("ClockSync", () => {
  it("seeds offset from median-of-5 handshake (discards min/max)", () => {
    const sync = new ClockSync();
    // Simulate 5 round-trips with RTTs [50, 52, 51, 1200 /*outlier*/, 49]
    sync.recordHandshake({ serverTime: 1000, clientSendTime: 0,   clientReceiveTime: 50 });
    sync.recordHandshake({ serverTime: 1026, clientSendTime: 52,  clientReceiveTime: 104 });
    sync.recordHandshake({ serverTime: 1051, clientSendTime: 102, clientReceiveTime: 153 });
    sync.recordHandshake({ serverTime: 1600, clientSendTime: 150, clientReceiveTime: 1350 }); // outlier
    sync.recordHandshake({ serverTime: 1373, clientSendTime: 1349, clientReceiveTime: 1398 });
    // Median-of-5 discards min/max — result dominated by the tight 3 samples.
    expect(sync.offsetMs).toBeCloseTo(975, -1); // offset ~= serverTime - clientMid, approx
    expect(sync.isReady()).toBe(true);
  });

  it("isReady() is false before 5 handshake samples", () => {
    const sync = new ClockSync();
    for (let i = 0; i < 4; i++) {
      sync.recordHandshake({ serverTime: 1000, clientSendTime: 0, clientReceiveTime: 50 });
    }
    expect(sync.isReady()).toBe(false);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
interface Sample { serverTime: number; clientSendTime: number; clientReceiveTime: number; }

export class ClockSync {
  private handshakeSamples: number[] = [];
  private emaOffset = 0;
  private readonly ALPHA = 0.3;

  /** Returns the computed offset (serverTime - clientTime) in ms. */
  get offsetMs(): number { return this.emaOffset; }

  isReady(): boolean { return this.handshakeSamples.length >= 5; }

  recordHandshake(s: Sample): void {
    const rtt = s.clientReceiveTime - s.clientSendTime;
    const oneWay = rtt / 2;
    // Estimated client time at moment server stamped: clientSendTime + oneWay
    const offset = s.serverTime - (s.clientSendTime + oneWay);
    this.handshakeSamples.push(offset);
    if (this.handshakeSamples.length === 5) {
      const sorted = [...this.handshakeSamples].sort((a, b) => a - b);
      // Discard min + max, average the middle three (= median-of-5).
      const mid = (sorted[1] + sorted[2] + sorted[3]) / 3;
      this.emaOffset = mid;
    } else if (this.handshakeSamples.length > 5) {
      this.emaOffset = this.ALPHA * offset + (1 - this.ALPHA) * this.emaOffset;
    }
  }

  toServerTime(clientTime: number): number { return clientTime + this.emaOffset; }
}
```

- [ ] **Step 4: Verify tests pass.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/clock-sync.ts src/lib/clock-sync.test.ts
git commit -m "feat(sync): client clock-offset estimator with median-of-5 cold start"
```

---

## Task 10: `useInterpolatedProgress` hook

**Files:**
- Create: `src/hooks/useInterpolatedProgress.ts`
- Test: `src/hooks/useInterpolatedProgress.test.ts`

- [ ] **Step 1: Write the failing test**

Test 3 behaviors:
1. Lerps between two bracketing samples at render time `now - 200 ms`.
2. Warmup mode uses 350 ms delay until `clockSync.isReady()` is true.
3. On underflow, extrapolates for up to 150 ms then freezes.

```ts
import { describe, it, expect } from "vitest";
import { computeInterpolatedCharIndex } from "@/hooks/useInterpolatedProgress";

describe("computeInterpolatedCharIndex", () => {
  it("lerps between bracketing samples", () => {
    const samples = [
      { serverTime: 1000, charIndex: 10 },
      { serverTime: 1100, charIndex: 20 },
    ];
    // render at t=1050 (midway): expect ~15
    expect(computeInterpolatedCharIndex(samples, 1050)).toBe(15);
  });

  it("extrapolates up to 150ms past the last sample", () => {
    const samples = [{ serverTime: 900, charIndex: 10 }, { serverTime: 1000, charIndex: 20 }];
    // render at t=1100 (100ms past last): velocity is 0.1/ms, so charIndex = 20 + 100*0.1 = 30
    expect(computeInterpolatedCharIndex(samples, 1100)).toBe(30);
  });

  it("freezes (returns last charIndex) past the 150ms extrapolation window", () => {
    const samples = [{ serverTime: 900, charIndex: 10 }, { serverTime: 1000, charIndex: 20 }];
    expect(computeInterpolatedCharIndex(samples, 1151)).toBe(20);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

Extract the pure logic as `computeInterpolatedCharIndex(samples, renderTime)` alongside the hook so it's testable.

```ts
import { useEffect, useRef, useState } from "react";

export interface Sample { serverTime: number; charIndex: number; }
const STEADY_DELAY_MS = 200;
const WARMUP_DELAY_MS = 350;
const EXTRAP_MS = 150;

export function computeInterpolatedCharIndex(samples: Sample[], renderTime: number): number {
  if (samples.length === 0) return 0;
  if (samples.length === 1) return samples[0].charIndex;
  // Find bracketing pair.
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i], b = samples[i + 1];
    if (renderTime >= a.serverTime && renderTime <= b.serverTime) {
      const t = (renderTime - a.serverTime) / (b.serverTime - a.serverTime);
      return a.charIndex + t * (b.charIndex - a.charIndex);
    }
  }
  // Past the latest sample — maybe extrapolate.
  const last = samples[samples.length - 1];
  const prev = samples[samples.length - 2];
  const overshoot = renderTime - last.serverTime;
  if (overshoot <= EXTRAP_MS) {
    const velocity = (last.charIndex - prev.charIndex) / (last.serverTime - prev.serverTime);
    return last.charIndex + overshoot * velocity;
  }
  return last.charIndex;
}

export function useInterpolatedProgress(
  userId: string,
  samplesRef: React.RefObject<Map<string, Sample[]>>,
  clockSyncIsReady: () => boolean,
  toServerTime: (clientMs: number) => number,
): number {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>();
  useEffect(() => {
    const tick = () => {
      const delay = clockSyncIsReady() ? STEADY_DELAY_MS : WARMUP_DELAY_MS;
      const renderTime = toServerTime(performance.now()) - delay;
      const samples = samplesRef.current?.get(userId) ?? [];
      setProgress(computeInterpolatedCharIndex(samples, renderTime));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [userId, samplesRef, clockSyncIsReady, toServerTime]);
  return progress;
}
```

- [ ] **Step 4: Verify tests pass.**

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useInterpolatedProgress.ts src/hooks/useInterpolatedProgress.test.ts
git commit -m "feat(client): entity-interpolation hook with warmup/steady/extrap/freeze"
```

---

## Task 11: OpponentBird uses interpolated progress + freeze pose

**Files:**
- Modify: `src/components/OpponentBird.tsx` (or wherever opponent birds render — verify path before editing)

- [ ] **Step 1: Read the current component**

`grep -n "opponent" src/components/` — find the file that actually renders opponent birds (name may vary).

- [ ] **Step 2: Consume `useInterpolatedProgress`**

Replace the direct `charIndex` prop usage with the hook, passing the sample buffer from `useMultiplayerRace`.

- [ ] **Step 3: Freeze pose when `isConnected === false` OR extrapolation has fully frozen**

Render the "..." bubble only for the disconnect case. For a transient freeze, drop `flapFPS` to the idle 4 fps and pause feather emission (Phase 5 will wire feathers; today just document the attachment point with a TODO).

- [ ] **Step 4: Manual smoke**

Run both dev servers, simulate two-browser race, verify opponents glide instead of teleport and that disconnect-reconnect works end-to-end.

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "feat(client): OpponentBird consumes interpolated progress; freeze on disconnect"
```

---

## Task 12: Wire `useMultiplayerRace` to the time-sync handshake + resume

**Files:**
- Modify: `src/hooks/useMultiplayerRace.ts`

- [ ] **Step 1: Add a `ClockSync` instance**

Instantiate on mount. On `connect`, emit 5 consecutive `time-sync-ping` messages, record server responses via `ClockSync.recordHandshake`.

- [ ] **Step 2: On `player-progress` broadcasts, push into the per-opponent sample buffer**

`{ serverTime, charIndex }` per player — pass the buffer map to the interpolation hook.

- [ ] **Step 3: On socket disconnect event**, attempt reconnect with stored `resumeToken`; on success, apply `resume_state` snapshot (overwrite local `charIndex`, seed opponent sample buffers, restore combo state).

- [ ] **Step 4: Manual smoke + existing tests pass**

`cd server && npx vitest run && npx vitest run` — everything still green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMultiplayerRace.ts
git commit -m "feat(client): wire time-sync handshake, sample buffering, resume-state application"
```

---

## Task 13: Integration test — reconnect-resume end-to-end

**Files:**
- Create: `server/tests/integration/reconnect.test.ts`

- [ ] **Step 1: Write the test**

Using the `room-lifecycle.test.ts` pattern (controller-level, fake timers with `performance` faked):
1. Start a race with two players.
2. "Disconnect" alice (call roomManager's disconnect path directly).
3. Advance timers 18s (within the 20s window).
4. Call the reconnect handler with a valid `resumeToken`; assert:
   - Old socket's seat is removed
   - New socket receives `resume_state` with alice's `charIndex` and a snapshot of bob's state
   - `epochs[alice]` incremented by 1

- [ ] **Step 2: Run — iterate implementation until passing.**

- [ ] **Step 3: Commit**

```bash
git add server/tests/integration/reconnect.test.ts
git commit -m "test(integration): reconnect resumes within 20s window with full snapshot"
```

---

## Task 14: Final verification + tag

- [ ] **Step 1: Full test sweep**

```bash
cd server && npx vitest run                          # 140+ PASS
cd /Users/student/Documents/accelerate-avians && npx vitest run   # passes except the 6 pre-existing failures
```

- [ ] **Step 2: Manual 2-browser smoke**

Two browser windows → start multiplayer race → close one tab → reopen within 20s → verify bird resumes → typing progress on both sides glides smoothly.

- [ ] **Step 3: Tag the phase**

```bash
git tag -a phase-2-reconnect-interpolate -m "Phase 2 complete: entity interpolation + clock sync + reconnection"
```

---

## Spec coverage

| Spec section | Task(s) |
|--------------|---------|
| § 2.2 opponent interpolation + clock sync + freeze | 5, 9, 10, 11 |
| § 2.3 reconnection protocol (HMAC, epoch, fence, snapshot) | 1, 2, 3, 4, 7, 12, 13 |
| § 2.4 transport + ping + deflate + buffer + slow consumer | 6, 8 |

## Explicit non-goals for Phase 2

- ❌ Redis adapter (documented scaling ceiling; Phase 2 stays single-instance)
- ❌ Feather trail / combo glow under freeze (Phase 5)
- ❌ iPad-with-keyboard detection (Phase 5)
- ❌ Any anti-cheat threshold changes (Phase 4)
