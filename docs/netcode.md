# Accelerate Avians — Netcode

This document describes the multiplayer networking stack: server-authoritative scoring, client-side entity interpolation with explicit clock sync, HMAC-fenced reconnection, and the load-test results that back the resume bullet's capacity claims.

Companion spec: [`docs/superpowers/specs/2026-04-16-netcode-and-polish-design.md`](./superpowers/specs/2026-04-16-netcode-and-polish-design.md).

---

## 1. Problem statement

Multiplayer races in the original implementation had three correctness and robustness gaps:

1. **Score was computed from client-supplied timing data** — `player-finished` carried a `ghostData` array whose `ms` field was used to derive WPM. A malicious client could fabricate `{ charIndex, ms }` pairs claiming a 1-second finish.
2. **Any brief disconnect was terminal (DNF)** — Socket.IO's default reconnection returned the user to the lobby; the in-flight race was lost even on a 500 ms WiFi hiccup.
3. **Opponent birds teleported** — the server broadcast progress at 10 Hz but the client rendered each sample immediately, producing visible jitter at broadcast boundaries.

Phases 1 and 2 addressed these. Phase 3 (this document's § 7) measures the system's capacity.

## 2. Server-authoritative scoring

The core insight: the server already observes every keystroke via `typing-progress` events. It doesn't need the client's summary of when those keystrokes happened — it can stamp them itself.

On every `typing-progress` arrival, `connection-handler.ts` records `performance.now()` alongside the `charIndex`. `RaceController` maintains a per-player `serverGhost: Array<{ charIndex, serverMs }>`. When the player finishes, `calculateResults` derives WPM and accuracy from `serverGhost` — NOT from the client-supplied `ghostData`. Client data is preserved under a new column `clientGhostData` for the existing solo-mode replay visualization; it never influences leaderboards or match records.

Wire protocol is unchanged: clients still POST the `ghostData` field. Only the DB field name and the score-derivation input changed. This is why the integration test at `server/tests/integration/server-authority.test.ts` can craft a client payload claiming 1-second / 1200 WPM and assert the server stores ~60 WPM based on the actual 20 seconds of server-stamped progress.

### Trade-off considered

**Why not use client-supplied timing but validate it?** The only server-side signal we could validate against is server arrival time — which is exactly what `serverGhost` already captures. Keeping `ghostData` for scoring would mean running `validate(client-timing, server-timing)` on every event and rejecting mismatches. Simpler to just use the server timing as ground truth.

## 3. Entity interpolation

### The teleport problem

At 10 Hz broadcast, each opponent's position updates 100 ms apart. Without interpolation, the bird teleports from sample to sample. The classic fix is to render the opponent at a configurable delay behind wall-clock time, lerping between the two samples bracketing that delayed "render time."

### Our buffer

Each opponent has a FIFO sample buffer of `{ serverTime, charIndex }`. The renderer draws at `now − INTERP_DELAY_MS` in adjusted server-clock terms (see § 4 on clock sync). In steady state `INTERP_DELAY_MS = 200 ms`, which leaves two full broadcast intervals of lookback headroom. In warmup (before 5 clock-sync samples have been collected), the delay is 350 ms — tighter buffers would underflow while clock offset is still unstable.

### Dropped-packet handling

If the buffer underflows, the renderer extrapolates linearly for up to 150 ms using the velocity from the last two samples. Beyond that, it freezes at the last known `charIndex`. This is the § 2.2.1 **freeze visual contract**: opponent flap rate drops to the idle 4 fps (per Bird.tsx baseline), feather emission pauses, and a "..." bubble appears **only if `isConnected === false`**. A transient freeze during a packet-loss spike has no bubble — players can tell "network hiccup" from "they're gone."

### Why not extrapolate further

Past ~150 ms, extrapolated positions often overshoot. Real opponent motion isn't a smooth line — typists burst and pause. Freezing is less disorienting than a bird sliding past the end of the passage into the wall.

### Trade-off considered

**Why not 100 ms delay for snappier opponents?** At 100 ms delay with 100 ms broadcast interval, a single dropped or jittered packet guarantees an underflow frame. Playtests showed visible stutter even on localhost. 200 ms accepts one packet of jitter without visual disruption.

## 4. Clock sync

### Why EMA + median-of-5

The client's `performance.now()` and the server's `performance.now()` are independent monotonic clocks. The interpolator needs their offset so it can convert a locally-stamped render time into the server-time coordinate system the samples are recorded in.

On connect, the client fires 5 `time-sync-ping` messages at ~200 ms intervals. The server responds with `{ clientSendTime, serverTime }`. For each round the client computes:

```
offset = serverTime − (clientSendTime + rtt/2)
```

Taking 5 samples and **discarding the min + max** gives a median-of-5 seed. Why discard outliers? TCP slow-start, TLS resumption, and cold JIT all produce one abnormally high RTT in the first second; a naive average would be pulled toward it and the interpolator would freeze or overshoot for the first ~20 seconds of play (until the EMA decays). Median-of-5 avoids this.

After the seed, further keepalive pings update the offset via EMA with `α = 0.3`.

### Trade-off considered

**Why not just let the interpolator work in raw server-time?** The client doesn't know server time — every `setTimeout`/`rAF` tick returns `performance.now()` in local-clock terms. Without an offset, we'd compare apples and oranges. The handshake is ~1 second of round-trip overhead on connect; worth it.

## 5. Anti-cheat

Phase 4 of the spec calls for a corpus-calibrated statistical anti-cheat layer (keystroke-interval distribution, paste detection, WPM ceiling, per-update jump check). That work is not yet shipped. The infrastructure is in place:

- `Score.flagged Boolean` and `CheatViolation` model exist in the schema.
- Leaderboard + ghost-replay queries filter `flagged: false`.
- The existing synchronous `ProgressValidator` enforces bounds + monotonic + 30 updates/sec at the `KICK` level — this is the only enforcement live today.

Once Phase 4 ships, this section will document per-check thresholds, the labeled honest/cheat corpus, and precision/recall results.

## 6. Reconnection protocol

### Protocol

On `start-race`, the server mints `resumeToken = HMAC_SHA256(secret, { userId, roomCode, sessionEpoch, sessionId, issuedAt })` and emits `resume-token { token }` to each player. The client stashes the token.

On socket `disconnect` mid-race:
- Server marks `player.isConnected = false`, broadcasts `player-disconnected`, starts a 20-second timer.
- If timer fires without reconnect, server broadcasts `player-dropped`, marks DNF, removes the seat.
- Client detects disconnect, re-establishes transport, emits `reconnect { token }` on the new socket.

On `reconnect`:
1. Clerk middleware validates the new socket's session cookie → populates `newSocket.data.userId`.
2. `handleNewReconnect` increments the per-token attempt counter (before HMAC verify — so garbage tokens can't bypass the 3-attempt cap).
3. `verifyResumeToken` checks HMAC + expiry (20s window + 30s grace).
4. **Identity cross-check:** if `newSocket.data.userId !== token.userId`, reject with `reconnect-error { reason: "identity-mismatch" }`. Prevents cross-user session hijack.
5. **Epoch check:** compare token's `sessionEpoch` to the one persisted in `Match.epochs`. Stale tokens rejected.
6. **Synchronous socket fence:** call `oldSocket.disconnect(true)` + remove old seat binding IMMEDIATELY (not await the `disconnect` event).
7. Atomic `incrementEpoch` via `jsonb_set` SQL (single statement, no RMW window) → mint new token.
8. Emit `resume-state` with the player's `charIndex`, `raceElapsedMs`, combo fields, AND a full snapshot of every other player's `charIndex` + `isConnected` (so the reconnecting client's interpolator seeds cleanly).
9. Broadcast `player-reconnected`.

### Sequence diagram

```
client                          server                          other clients
  │                               │                                  │
  │──join-race──────────────────→ │                                  │
  │ ←────────resume-token(T)──────│                                  │
  │                               │                                  │
  │ xxxx disconnect xxxx          │                                  │
  │                               │──player-disconnected───────────→ │
  │                               │ (20s timer starts)               │
  │                               │                                  │
  │──(new transport)──────────→   │                                  │
  │──reconnect(T)───────────────→ │                                  │
  │                               │ [verify Clerk + HMAC + identity  │
  │                               │  + epoch → fence old socket →    │
  │                               │  incrementEpoch → mint new T']   │
  │ ←────resume-state(T', snap)───│                                  │
  │                               │──player-reconnected─────────────→│
  │                               │ (timer cleared)                  │
```

### Trade-off considered

**Why not let Socket.IO's `connectionStateRecovery` handle this?** The built-in feature buffers messages and re-delivers them on reconnect, but it runs BEFORE any application-level handler. It would bypass the HMAC validation, the epoch check, the identity cross-check, and the socket fence. We explicitly removed `connectionStateRecovery` from the `new Server(...)` options because the two paths conflict.

## 7. Load test

All measurements from a single macOS Apple Silicon development machine — CPU 8 cores, RAM 16 GB, Node 24.14.0, k6 v1.7.1. Server runs on `ws://localhost:3001` against a Railway-hosted Postgres (network latency to Railway matters for `db-finalize`; everything else is loopback).

### 7.1 Broadcast fanout

**Scenario:** `scripts/load-test/broadcast-fanout.js` — four stages in sequence. Each stage runs for 30 s at the configured room count, with 4 virtual users per room typing at 8 Hz. k6's built-in `broadcast_latency_ms` Trend records the difference between a sender's client-stamped `sentAt` (echoed through the server) and each peer's receive time.

**Results** (analyzed via `scripts/load-test/analyze-broadcast-fanout.ts`):

| Stage      | Rooms | VUs  | Samples | p50 (ms) | p95 (ms) | p99 (ms) | max (ms) |
|------------|-------|------|---------|----------|----------|----------|----------|
| `rooms_50`  | 50    | 200  | 119,572  | 0.0      | 2.0      | 3.0      | 8.0      |
| `rooms_100` | 100   | 400  | 239,443  | 0.0      | 3.0      | 4.0      | 18.0     |
| `rooms_200` | 200   | 800  | 479,325  | 0.0      | 3.0      | 7.0      | 29.0     |
| `rooms_400` | 400   | 1600 | 946,931  | 102.0    | 378.0    | 488.0    | 671.0    |

**Headline:** a single Node process on this machine sustains **200 concurrent rooms (800 virtual typists) with p99 broadcast latency under 10 ms** on loopback. The cliff between 200 and 400 rooms (p99 jumps from 7 ms to 488 ms) marks the single-instance capacity ceiling. Scaling beyond would require either vertical (more CPU) or horizontal (multi-instance with Redis adapter — noted as a scaling-ceiling path in spec § 2.4).

**Measurement disclosure:** loopback isolates server-side overhead and Socket.IO fanout cost, but excludes real-internet RTT. The numbers characterize what the server can process; add one-way-latency to estimate end-to-end perceived latency on a real network.

### 7.2 DB finalize under burst

**Scenario:** `scripts/load-test/db-finalize.ts` — 800 concurrent `matchPlayer.updateMany` calls jittered across a 5-second window, against a pre-seeded Match with 800 MatchPlayer rows. Mimics 200 rooms × 4 players all finishing within the same 5 s.

**Result:**

| Metric | Value |
|--------|-------|
| Per-call p50 latency | 1753 ms |
| Per-call p95 latency | 3204 ms |
| Per-call p99 latency | **3320 ms** |
| Wall-clock to completion | 8.3 s |
| Threshold (§ 2.5.3) | p99 < 500 ms |
| **Verdict** | **FAIL** (6.6× over threshold) |

**Root cause:** Prisma's default connection pool is 10. 800 concurrent calls queue through those 10 connections serially, so each call waits for ~N/10 = 80 other calls to complete before executing. The 8.3 s total wall clock is consistent with 800 calls × ~10 ms per query ÷ 10 pool slots.

**Remediations** (not pursued in Phase 3 scope — documented for future hardening):
1. Bump Prisma `pool_size` to 50–100 (Railway's Postgres hobby tier accepts up to 97 connections).
2. Batch finalize via `matchPlayer.updateMany` with composite WHERE, reducing 800 queries to N per batch.
3. Move non-critical writes (ghost-data persistence) off the hot path into a queue.

The failure is publishable — it's the answer to "what's the limit of this system, and what would you change?"

### 7.3 Connection churn (leak profile)

**Scenario:** `scripts/load-test/connection-churn.ts` — 200 sequential raw-WebSocket connect-join-progress-disconnect cycles against the `/loadtest` endpoint. Samples process RSS and FD count before and after, with a 5-second settle window.

**Result:**

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| RSS    | 52.4 MB | 52.4 MB | **0 MB** |
| Open FDs | 20 | 20 | **0** |

**Verdict:** PASS. 200 connect-disconnect cycles leave the server at identical steady state, confirming the raw-WS endpoint's cleanup is tight. The Socket.IO connection cleanup (registerSocket / unregisterSocket / SlowConsumerSampler interval clearing / tokenAttempts TTL) is independently verified by unit tests; not exercised here because the Clerk-auth middleware prevents easy scripted connections.

### 7.4 ProgressValidator (KICK enforcement)

The `30 updates/sec` rate limit and the monotonic + bounds checks are enforced synchronously in `server/src/race/progress-validator.ts` and verified by 11 passing unit tests. A k6 stress scenario would add little above the existing tests; omitted from Phase 3.

### 7.5 SlowConsumerSampler

The `>64 KB buffered for 2 consecutive 2-second samples → disconnect` contract is verified by 4 passing unit tests in `connection-handler.test.ts`. k6's WebSocket client drains frames internally so the client-side back-pressure is hard to reproduce; the unit tests are authoritative for this contract.

## 8. Trade-offs considered (and rejected)

| Alternative | Rejected because |
|---|---|
| Client-side prediction + rollback | The wrong problem — local input is already echoed with zero perceived latency. Prediction is for remote input, not local. |
| Delta compression on broadcasts | Progress payload is already < 100 bytes. Compression overhead would dominate the savings. |
| UDP / WebRTC transport | At 10 Hz with required reliable ordering (monotonic check, rate limit), the browser complexity buys nothing measurable. Production game dev needs UDP; portfolio game doesn't. |
| Socket.IO `connectionStateRecovery` | Conflicts with our HMAC-fenced reconnect: built-in recovery bypasses epoch validation. Explicitly removed from server options. |
| Hard-block mobile | False-positives iPad-with-keyboard. Soft prompt ("come back on a laptop") is the Phase 5 UX. |
| GIF for hero video | Ignores `prefers-reduced-motion`, no pause control. Will use `<video autoplay muted loop playsinline>` with a poster fallback in Phase 5. |
| Eyeballing anti-cheat thresholds | Indefensible in an interview. Phase 4 uses a labeled honest/cheat corpus with a ≥95% precision gate per check. |
| Storing raw keystroke arrays on `CheatViolation` | PII concern. Only aggregate numerics (the single offending stddev, interval, or WPM) are persisted. |
| Vercel Cron for pruning `CheatViolation` rows | The rows live in Railway-hosted Postgres behind the game-server process. Railway's built-in scheduler avoids a Vercel → Railway HTTP hop with auth. |
| `AudioBufferSourceNode` pooling | Source nodes are single-use per Web Audio spec. Pool the `GainNode` chain instead. |

## 9. Secrets & config

| Env var | Required | Purpose |
|---|---|---|
| `RESUME_TOKEN_SECRET` | yes, ≥ 32 bytes | HMAC secret for `resumeToken` signing. Server boot fails without it. Generate with `openssl rand -hex 32`. Rotation invalidates in-flight tokens — acceptable; reconnect-window races are rare. |
| `DATABASE_URL` | yes | Prisma connection string (Railway Postgres). |
| `CLERK_SECRET_KEY` | yes | Clerk auth middleware on Socket.IO. |
| `CLERK_PUBLISHABLE_KEY` | yes | Clerk session validation. |
| `CORS_ORIGIN` | default `http://localhost:3000` | CORS allowlist for the Socket.IO server. |
| `PORT` | default `3001` | Socket.IO server port. |
| `LOADTEST_ENDPOINT` | optional | When `=1`, enables the raw-WS `/loadtest` endpoint. **NEVER set in production** — the endpoint bypasses auth. |

`.env.example` at both repo root and `server/.env.example` carry the full list with placeholder values. `.env` is gitignored; `.env.example` is committed.
