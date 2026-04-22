# Accelerate Avians — Netcode Hardening & Polish Pass

**Date:** 2026-04-16
**Author:** Sarah Yoon
**Goal:** Elevate Accelerate Avians into a portfolio piece strong enough to carry a new-grad SWE interview at Amazon Games — one deep multiplayer-engineering story plus a first-impression polish layer that hooks a recruiter in under 30 seconds.

---

## 1. Outcome

After this work lands:

1. A recruiter clicking the deploy link is playing a typing race within ~15 seconds (guest mode, no signup), and the game *feels* good (juice, audio, animation).
2. Three interview-ready technical stories exist: server-authoritative scoring with statistical anti-cheat, client-side entity interpolation with explicit clock-sync, load test with measured p50/p99 broadcast latency on isolated infrastructure.
3. A `docs/netcode.md` writeup is linked from the README, including a trade-offs-considered section (§ 4.3).
4. Resume bullet is truthful and specific. Numerical claims (concurrent rooms, latency) are written as `{N}` / `{X}` placeholders until `docs/netcode.md` lands with measured values; final numbers are sourced from a committed doc and never fabricated. Two bullet variants are pre-written for the ≥95%-precision-cleared and LOG-only-fallback cases (§ 4.1).
5. A Week-1 minimum viable improvement (§ 7.1) is shippable in ~5–7 days even if the rest of the work doesn't complete before the recruiter responds.

Explicit non-goals: § 6.

## 2. Track A — Netcode & Anti-cheat

### 2.0 Server-authoritative scoring (foundational change)

**Problem in current code:** `RaceController.playerFinished` (`server/src/race/race-controller.ts:83`) accepts `ghostData` from the client and feeds it into both `calculateResults` (WPM, accuracy) and the proposed statistical anti-cheat. A cheater can synthesize plausible keystroke intervals and trivially evade every check while inflating WPM. The "server-authoritative" claim is false as long as scoring depends on client-supplied data.

**Resolution:**

- Every `progress_update` is stamped with `serverReceivedAt = performance.now()` on arrival in `connection-handler.ts`. This stream is the source of truth.
- `RaceController` builds `serverGhost: Array<{ charIndex, serverMs }>` from these stamps per player. WPM, accuracy, and statistical anti-cheat are computed from `serverGhost` only.
- Client-supplied `ghostData` is accepted but used **only for replay visualization** (the existing solo-mode ghost feature). Stored under a clearly-named field `clientGhostData` on `Score`.
- README and resume bullet qualify "server-authoritative" as "scoring derived from server-timestamped progress stream; client keystroke data is replay-only."

### 2.1 Expanded anti-cheat

Existing synchronous checks (`server/src/race/progress-validator.ts`): bounds, monotonic, 30 updates/sec rate limit. Wired through `connection-handler.ts` so a `valid: false` result drops the message; persistent violations within a race promote to `KICK`.

Add post-race statistical analysis in a new `server/src/race/cheat-detector.ts`. **All thresholds are starting values to be calibrated against a labeled corpus before promotion past `LOG`** (§ 2.1.3).

#### 2.1.1 Statistical checks (computed from `serverGhost`)

- **Keystroke-interval distribution** — flag if either:
  - `min(intervals) < 12 ms` over the full race
  - `stddev(intervals) < 10 ms` over any 30-keystroke rolling window AND `mean(intervals) > 50 ms`
- **First-burst paste detection** — ≥ 20 chars submitted within the first two `progress_update` messages after race start. Composed chars (§ 2.1.2) count toward this total.
- **Per-update jump check** — server-derived: after the first second, any single `progress_update` advancing more than 5 chars is flagged. Threshold calibrated per § 2.1.3.
- **WPM ceiling** — final server-derived WPM > 220 is flagged. `LOG`-only and never auto-promoted.
- **Abnormal composed-segment length** — any composed segment with length > 12 chars is flagged at `LOG`.

#### 2.1.2 Input handling that affects anti-cheat

- **Event source pinned to `keydown`.** Thresholds calibrated against `keydown` intervals.
- **Timestamp source pinned to `performance.now()`** on both client and server.
- **IME / composition events**: client groups composed characters as a single logical input event for `progress_update` and tags the message `composed: true`. Server-side `cheat-detector` excludes composed-char intervals from interval statistics. **Maximum composed-segment length is 12 chars** — segments above are still accepted but flagged at `LOG` per § 2.1.1. First-burst paste detection counts composed chars same as regular chars.
- **Paste blocked at the client** on all race screens via `onPaste` `preventDefault()`. Server-side first-burst check is defense-in-depth.
- **Tab / Enter / non-ASCII filter.** Race input filters to printable characters present in the passage. Tab is **consumed as a passage character only when the race input element has DOM focus AND no modifier key is held**; bare `Tab` / `Shift+Tab` while focused on any other element navigates normally. `Esc` is always honored. Modifier keys are never consumed (this is also why mid-race `Ctrl+M` works for mute, § 3.4). See § 3.6 for the full keyboard-a11y rule and the axe-core scope.

#### 2.1.3 Calibration before promotion

Before any check is promoted past `LOG`:

1. Author collects a labeled fixture corpus in `server/test/fixtures/cheat-corpus/`:
   - **Honest samples**: target ≥ 20 race recordings across WPM tiers. Sourcing waterfall: (a) author-recorded across 3 difficulty tiers and with IME emulation, (b) 2–3 friends if available, (c) **fallback if friends unavailable**: synthesize honest samples by re-timing the public Aalto **136M Keystrokes Dataset** (CC-BY) into the project's passage format. The writeup discloses corpus composition (single-typist vs. multi-typist) honestly.
   - **Cheat samples**: ≥ 5 synthesized per check type (paste, uniform-bot, macro-paced, jump, oversized-composition).
2. `cheat-detector.test.ts` runs each check against the corpus and reports precision/recall.
3. A check is eligible for `INVALIDATE` only if it achieves **≥ 95% precision** on the honest corpus.
4. If a check can't hit 95% precision after threshold tuning, it stays at `LOG` and is documented as "review signal, not enforcement."

#### 2.1.4 Enforcement levels

| Level | Behavior |
|-------|----------|
| `LOG` | Store violation, accept score normally |
| `INVALIDATE` | Accept race result but set `score.flagged = true`, exclude from leaderboards |
| `KICK` | Synchronous validator only — drops message, accumulates strikes, disconnects on threshold |

#### 2.1.5 `CheatViolation` data model

- New Prisma model `CheatViolation`: `id`, `userId`, `matchId` (nullable for solo), `check` (string enum), `severity`, `numericValue` (single float), `action`, `createdAt`.
- **No raw keystroke timing arrays stored on `CheatViolation`.**
- **Per-match cap**: at most 5 violation rows per (`userId`, `matchId`).
- **Retention**: rows older than 30 days deleted by `scripts/prune-violations.ts`. **Run via Railway's built-in scheduler** (not Vercel Cron — `CheatViolation` lives in the Railway-hosted Postgres, accessible from the game-server process; routing pruning through Vercel would mean a Vercel→Railway HTTP hop with auth, which is unnecessary complexity).
- **Privacy disclosure** in README + in-app footer: "We log anti-cheat signals (timing statistics, not keystroke content) for 30 days to keep leaderboards honest."

### 2.2 Opponent interpolation (client-side)

**Problem:** Server broadcasts opponent progress at ~10 Hz; client currently snaps opponent birds.

**Approach:**

- Server adds `serverTime: performance.now()` to every broadcast. Client maintains smoothed offset `serverClockOffset` via EMA over `(serverTime − clientTime − rtt/2)` from the last 10 samples. Keepalive ping/pong (every 2 s) feeds the same estimator.
- **EMA cold-start handling**: the offset estimator is seeded by a dedicated `time-sync` handshake during `room_join` — **5 paired ping/pong rounds in the first second after auth, with the min and max samples discarded (median-of-5 seed)** to avoid TCP slow-start / TLS-resumption / cold-JIT outliers poisoning the seed. **Rate-limited to one handshake per socket lifetime**; subsequent re-syncs use the steady-state keepalive stream.
- Until ≥ 5 valid samples have accumulated, the renderer uses a **larger interpolation buffer of 350 ms** (warmup mode); at ≥ 5 samples it tightens to steady-state.
- Each opponent has a FIFO buffer of `{ serverTime, charIndex }` samples. **Steady-state buffer depth target: 3 broadcast intervals (~300 ms) — this is the *buffer depth* covering both lookback and lookahead.** **Render lag is `INTERP_DELAY_MS = 200 ms`** (in adjusted server-clock terms). The 100 ms gap between buffer depth and render lag is the lookahead headroom for jitter and one dropped packet. (Documented to avoid future-reader confusion that 300 vs 200 is a contradiction.)
- Renderer interpolates between the two bracketing samples with `lerp`.
- **Extrapolation policy**: on buffer underflow, extrapolate linearly for up to 150 ms (1.5 broadcast intervals), then **freeze** with the visual contract in § 2.2.1.

#### 2.2.1 Freeze visual contract

When an opponent's interpolation freezes (sustained packet loss OR `isConnected === false`):

- **Bird flap rate drops to idle 4 fps** (matches the Bird.tsx baseline; derived opponent WPM is pinned to `0` during freeze per § 3.1).
- **Feather emission paused for that bird.** No new feathers; existing already-emitted feathers continue their normal lifespan independently (they're decoupled from the bird once spawned).
- **During the 150 ms extrapolation window *before* freeze** (sustained loss not yet confirmed): feather emission **continues at the extrapolated position**. Already-emitted feathers are decoupled, so a snap-back on recovery doesn't visibly drag the trail with it; only the bird itself snaps.
- The **"..." bubble appears above the bird if `isConnected === false`** (consistent with the existing disconnect treatment); the bubble does NOT appear during a brief sustained-loss freeze where `isConnected` is still `true`, so players can distinguish "network hiccup" from "they're gone."
- On reconnect / sample arrival, animation resumes at the next interpolated position and feather emission resumes normally.

Files: `src/hooks/useInterpolatedProgress.ts`, `src/lib/clock-sync.ts`, `src/components/OpponentBird.tsx`. Local player's bird is never interpolated.

### 2.3 Reconnection / resume

**Protocol:**

1. On `room_join`, server issues `resumeToken = HMAC(secret, JSON.stringify({ userId, roomCode, sessionEpoch, sessionId, issuedAt }))` and sends it to the client. `sessionEpoch` is monotonically incremented per (`userId`, `roomCode`) join. `sessionId` is a 16-byte random nonce per join (defense-in-depth: tokens are unguessable even if the secret leaks).
2. **HMAC secret**: read from `RESUME_TOKEN_SECRET` env var at server boot; **boot fails if missing or shorter than 32 bytes**. `.env.example` carries a placeholder with comment ("REGENERATE — `openssl rand -hex 32`"). Rotation invalidates in-flight tokens by design.
3. **Token expiry**: `issuedAt` is in the HMAC payload. Server rejects tokens with `now − issuedAt > RECONNECT_WINDOW_MS + 30_000` (45 s grace).
4. **`sessionEpoch` persistence with concurrency safety**: stored in Postgres on `Match.epochs: Json` column. **Increment uses a single atomic statement** to avoid read-modify-write races on near-simultaneous reconnects:
   ```sql
   UPDATE "Match"
   SET epochs = jsonb_set(
     COALESCE(epochs, '{}'::jsonb),
     ARRAY[$userId],
     to_jsonb(COALESCE((epochs->>$userId)::int, 0) + 1)
   )
   WHERE id = $matchId
   RETURNING epochs->>$userId AS new_epoch;
   ```
   The new epoch returned by the statement is the one minted into the new `resumeToken`. No read-modify-write window.
5. On socket `disconnect`, room manager retains the player's seat and `lastCharIndex` for `RECONNECT_WINDOW_MS = 20_000` (raised from 15 s). At the new ping settings (§ 2.4), worst-case detection is ~13 s, leaving a real ~7 s margin for TLS + Clerk re-auth on a flaky LTE connection. Player marked `isConnected = false`. Server broadcasts `player_disconnected`.
6. On reconnect, client sends `{ resumeToken, userId, roomCode }` over a new socket. Server:
   - Verifies the Clerk session token on the new socket (re-auth).
   - Verifies `resumeToken` HMAC, that `sessionEpoch` matches the persisted one, and `issuedAt` is within bounds.
   - **Synchronously fences the older socket** with `oldSocket.disconnect(true)` (forces Socket.IO teardown of rooms and listener bindings). Removes the old socket's seat binding from `RoomManager` immediately.
   - Increments `sessionEpoch` via the atomic statement above, mints a new `resumeToken`, sends `resume_state` containing:
     - The resuming player's `charIndex`, `raceElapsedMs`, `comboCount`, `comboPaused: boolean`, `comboPausedAtCharIndex`.
     - **Full snapshot of every other player's** current `charIndex` and `isConnected` state.
   - **Per-token reconnect cap**: each `resumeToken` is valid for at most 3 verify attempts before being rejected. Encourages a fresh `room_join` for genuinely flaky clients rather than allowing infinite retries.
7. **Client-side: server's `charIndex` from `resume_state` is authoritative.** The client adopts the server value and the local input echo rolls forward to that index before accepting new keystrokes — prevents the client from re-typing already-acked chars (which would fail `monotonic` and stick input).
8. After 20 s without reconnect, mark DNF, broadcast `player_dropped`, race proceeds.
9. Race ends when all *connected* players finish or the race timeout fires.

Files: `server/src/handlers/connection-handler.ts`, `server/src/rooms/room-manager.ts`, `server/src/lib/resume-token.ts` (new).

### 2.4 Network configuration & transport pinning

- Pin Socket.IO transports to `['websocket']`. Disable polling fallback.
- **Disable per-message deflate** (`perMessageDeflate: false`). Payloads are < 100 bytes; compression wastes CPU and is a known CRIME-class attack surface for sensitive payloads.
- **Cap incoming frame size**: `maxHttpBufferSize: 16384` (16 KB; default 1 MB is excessive for ~100-byte progress messages and makes payload-bomb attacks noisy).
- Tune `pingInterval = 5_000`, `pingTimeout = 8_000`. Worst-case detection ~13 s; reconnect window is now 20 s (§ 2.3 step 5), leaving real margin.
- **Slow-consumer policy**: the connection handler samples each socket's outgoing buffer every 2 s. If a socket's buffered-amount exceeds 64 KB (≈ 800 progress messages backlogged) for two consecutive samples, the slow-consumer is force-disconnected with reason `"buffer-overflow"`. This is exercised in `slow-consumer.js` load-test scenario (§ 2.5.3).
- Verify `TCP_NODELAY` is set (Socket.IO default). Documented in `docs/netcode.md`.
- Document load-balancer requirement: WebSocket upgrade requires sticky sessions if Railway adds a multi-instance tier later. Currently single-instance.
- TCP head-of-line blocking note in `docs/netcode.md`: a single dropped packet stalls progress until retransmit — at 10 Hz this is tolerable but it's why the buffer needs the 3-sample headroom.

### 2.5 Load test

Script: `scripts/load-test.ts` using k6.

#### 2.5.1 Safety guards (allowlist)

- Reads `TARGET_URL` from env. **Default and only-allowed targets are `localhost`, `127.0.0.1`, `::1`.** Any other hostname requires explicit `ALLOW_NON_LOCAL=1` env to be set; without it, the script refuses to start.
- Hard duration cap of 5 minutes per run.
- **Lockfile guard**: `/tmp/aa-loadtest.lock` created on start (with PID), removed on exit; second invocation refuses if present (with stale-PID check).
- Documented in `docs/netcode.md`: "Load test runs against localhost only by default. Bypassing requires explicit env var. Production is forbidden."

#### 2.5.2 Methodology

- Spawns N virtual clients via WebSocket, groups into rooms of 4, each playing a 60-second synthetic race at 6–10 Hz.
- Clients stamp `clientSendTime`; receivers log `clientReceivedTime − clientSendTime − knownClockOffset` to derive end-to-end broadcast latency.
- **Disclosure** (writeup and resume bullet): "measured on a single host with virtual clients on loopback. Isolates server overhead and adapter fanout but excludes real internet latency."

#### 2.5.3 Scenarios

| Scenario | What it measures | Pass/fail threshold |
|----------|------------------|---------------------|
| `broadcast-fanout.js` | end-to-end progress latency at 50 / 100 / 200 / 400 rooms | Headline number, no hard threshold (results are reported as-measured) |
| `db-finalize.js` | DB write latency when 200 rooms finish within a 5-second window | p99 < 500 ms (catches Prisma pool exhaustion) |
| `rate-limiter.js` | Behavior when a client exceeds 30 updates/sec | All offending clients KICK'd within 1 s |
| `reconnect-storm.js` | 50 simultaneous reconnects within 20 s — measures latency, **server RSS delta, AND open-FD delta** (FD leaks classically present without RSS growth) | RSS growth < 5 MB, FD growth < 200, p99 reconnect latency < 1 s |
| `slow-consumer.js` | One socket per room with artificial 5 Mbps cap; verifies buffer-overflow disconnect fires within 4 s | All slow consumers disconnected with reason `buffer-overflow` |

#### 2.5.4 Adapter caveat

Single-instance Socket.IO uses the in-memory adapter. Multi-instance would require Redis adapter; broadcast fanout becomes O(rooms × instances). Documented as scaling-ceiling note.

#### 2.5.5 Output

Results written to `docs/netcode.md` per scenario, with environment disclosed (machine specs, Node version, Postgres version, **k6 version**). Resume bullet placeholders filled only after this table commits.

### 2.6 Files touched (Track A)

| Path | Change |
|------|--------|
| `server/src/race/progress-validator.ts` | unchanged |
| `server/src/race/cheat-detector.ts` | **new** — post-race statistical analysis using `serverGhost` |
| `server/src/race/race-controller.ts` | build `serverGhost`; pass to scoring & cheat-detector |
| `server/src/handlers/connection-handler.ts` | reconnection window, `serverReceivedAt`, transport/ping config, fence-old-socket synchronously, slow-consumer sampler |
| `server/src/rooms/room-manager.ts` | preserve disconnected state; epoch handling (atomic SQL) |
| `server/src/lib/resume-token.ts` | **new** — HMAC mint + verify, includes `sessionId` + `issuedAt` |
| `server/src/lib/clock-broadcast.ts` | **new** — `serverTime` on every broadcast; handles `time-sync` handshake (median-of-5, rate-limited) |
| `src/lib/clock-sync.ts` | **new** — client-side EMA estimator + cold-start handshake |
| `src/hooks/useInterpolatedProgress.ts` | **new** — warmup vs steady-state buffer; freeze visual contract |
| `src/components/OpponentBird.tsx` | consume interpolated progress; freeze pose |
| `prisma/schema.prisma` | **new** `CheatViolation`; add `Score.flagged`, `Score.serverGhost` (JSONB, retained only for flagged scores; nulled at race-end otherwise), `Score.clientGhostData` (renamed from `ghostData`); add `Match.epochs` JSON |
| `scripts/load-test.ts` | **new** — entry point with allowlist + lockfile |
| `scripts/load-test/*.js` | **new** — k6 scenarios including `slow-consumer.js` |
| `scripts/prune-violations.ts` | **new** — 30-day retention job (also nulls `serverGhost` on flagged scores after 30d) — invoked by Railway scheduler |
| `server/test/fixtures/cheat-corpus/` | **new** — honest + synthesized samples (Aalto fallback) |
| `docs/netcode.md` | **new** — writeup with tables, diagrams, trade-offs, secrets/config block |

`Score.serverGhost` retention rationale: full ghost arrays at ~5–10 KB JSONB across millions of races would balloon DB. Stored only on flagged scores (audit), nulled at 30 days even when retained. Unflagged scores keep `clientGhostData` for the existing replay feature.

`performance.now()` server note: monotonic but not wall-clock. If the server process restarts, `serverTime` baseline jumps backward relative to reconnecting clients (in practice, all sockets drop on restart so this is moot, but documented in `docs/netcode.md` so nobody persists `serverTime` as a long-lived timestamp).

## 3. Track C — Polish Pass

### 3.1 Juice (visual feedback)

All juice gated on `prefers-reduced-motion: no-preference`. When reduced motion is preferred (or in-app override on, § 3.4), shake/flash/particles disabled and combo glow becomes a static color tier with text label.

- **Word-complete flash**: on finishing a word with ≥ 95% accuracy, white overlay (opacity 0.15 → 0 over 180 ms) plus 2–3 px screen shake (80 ms). **Coalesce queue**: a flash-eligible word that arrives within the 200 ms window of a previously-played flash is queued; at the window boundary the **most recent queued flash fires** (not the oldest). Ensures a Skyborne-tier typist doesn't lose the reward feedback on short consecutive words.
- **Combo meter**: see § 3.5. Visual treatment is a tier label rendered as pixel-art text in the top-right HUD plus a CSS glow on the local player's bird. **Combo state is local-only — never broadcast to opponents and never displayed for opponent birds.** Prevents a side-channel where a kicked-and-returning attacker could infer which keystroke tripped a check by watching combo resets on reconnect, and keeps the focus on the local typing experience.
- **Bird feather-puff trail**: pixel-art feather sprite. Local-player emission interval = `clamp(1000 / Math.max(currentWPM / 20, 0.01), 80, 1200) ms`. Explicit guard against division-by-zero.
- **Wing-flap rate**: `flapFPS = clamp(currentWPM / 10, 4, 12)`. At 120 WPM = 12 fps; at 40 WPM = 4 fps.
- **`currentWPM` definition (local player)**: rolling average over the last 3 seconds of keystrokes. **Initialized to `0` (not `undefined`)** so the first ~3 seconds of feather emission and flap calculations don't `NaN`-cascade.
- **Opponent `currentWPM` (derived)**: rolling 3-second average of `Math.max(0, Δ charIndex) / Δ time` from the **interpolated rendered position** (not the latest sample), divided by 5 to convert chars→words. The `max(0, …)` guards against transient negative deltas during a resume-snap. Drives opponent flap rate and feather emission. **During interpolation freeze (§ 2.2.1) the derived opponent WPM is pinned to `0`** so flap drops to the idle 4 fps consistently with the freeze visual contract.
- **Race finish at `charIndex == passage.length`**: on receipt of the finish event, the **interpolator plays out to the finish sample** (so the last ~200 ms of approach motion isn't visually skipped), then **snaps to a finish-line idle pose**. This avoids both a jarring forward jump and any "running past the line" animation.

#### 3.1.1 Frame budget & low-end fallback

A 4-player race renders: player bird (12 fps flap + drop-shadow glow), feather emission, word-flash overlay, 3 opponent birds with interpolated positions and their own flap animations. CSS `filter: drop-shadow` is expensive (forces compositor layer; repaints on intensity change).

- **Concurrent feather cap**: 20 active particles **across all birds** (oldest recycled when cap is hit).
- **Feather emission position**: feathers emit at the **rendered (interpolated) position of each bird**, not the latest sample, so feathers stay attached visually. The single shared canvas reads positions per-frame from the interpolator.
- **Low-end fallback**: detected via `(navigator.deviceMemory ?? Infinity) <= 4 || navigator.hardwareConcurrency <= 4`. **`undefined deviceMemory` (Safari, Firefox) falls back to `hardwareConcurrency` alone** — never silently routes to the expensive path. When triggered, swap `filter: drop-shadow` for a static colored outline and halve the feather cap to 10. Same fallback under `prefers-reduced-motion`.
- **Particle rendering**: a single `<canvas>` for the whole scene; per-frame position read from the interpolator.
- **Playwright performance test**: synthetic 4-player race must hold **p95 frame time < 20 ms** across 30 s. **Pinned runner**: GitHub Actions `ubuntu-latest` (4-core, 16GB). **Retry policy**: 2-of-3 (test passes if any 2 of 3 attempts pass). CI gate. The relaxed p95 + retry policy account for runner variability; this is documented in the test file.

### 3.2 Audio

Small palette, **muted by default**, persistent toggle (§ 3.4).

- Correct-key click — 3 samples, pitch jittered ±5%
- Incorrect-key soft thud
- Countdown chirps (3-2-1)
- Race-finish ascending arpeggio
- Opponent-finished chime — fires only for the *first* opponent to finish ahead of you
- **Voice pool**: pre-allocated **`GainNode` chain pool (8 slots)** wired to a master `GainNode`. **`AudioBufferSourceNode` is created fresh per playback** (Web Audio spec: source nodes are single-use — `.start()` once, then dead). On exhaustion, voice-stealing prefers **the oldest *completed* voice** (slot whose source has fired its `ended` event but hasn't been recycled yet) before reaching for the **oldest *playing* voice**, whose gain is then ramped to 0 over 5 ms and its source `.stop()`'d. Buffer data (decoded once at boot) is referenced by each new source node; only the source-node objects churn, not the audio data.
- Assets: ~6 small `.ogg` files from freesound.org (CC0) or synthesized via `tone.js`. Sourcing decision made before audio implementation begins.

### 3.3 First-impression polish

- **Guest mode** — `src/app/play/guest/page.tsx`. Lands directly into a 45-second solo race against a scripted ghost. No signup. Score not persisted. `onPaste` blocked. Fallback per § 3.3.1.
- **Landing-page rewrite** — committed hero copy: H1 = `"Race the flock. Type fast."`, subhead = `"Pixel-bird typing races. Solo, friends, or strangers."` Hero visual is `<video autoplay muted loop playsinline preload="metadata" poster="/landing/hero-poster.png">` (NOT `.gif`); video is gated on `prefers-reduced-motion: no-preference`, replaced with the static poster otherwise. Single prominent `Play Now` (routes to guest mode), secondary "Sign up to track progress." Live counter via Next.js 16 `use cache` with `cacheLife({ stale: 60, revalidate: 300 })`; ranged display ("2,400+ races played"); counter card hides on query failure. Below the fold: features grid, leaderboard preview.
- **Lobby / waiting-room screen** (§ 3.3.2).
- **Loading states** — every Suspense boundary uses a desaturated pulsing pixel-art bird sprite plus a route-keyed text label.
- **Mobile detection** — soft prompt, not hard block (§ 3.3, § 3.3.1).
- **Error states** — closed list of 9 (§ 3.3.3), each with one-liner copy AND primary/secondary actions AND mapped state-overlay sprite.

#### 3.3.1 Mobile "Continue Anyway" fallback

If user picks Continue Anyway and gameplay is broken (no soft keyboard, autocorrect mangling input), the race screen surfaces a non-blocking banner: `"Looks like input isn't working. Back to home?"` with `Back to Home` and `Dismiss` buttons. **Trigger condition: 5 s after the race-start countdown ends, if `0` valid keystrokes have arrived** (NOT focus-tied — on iOS the soft keyboard may never bind focus to the field, so a focus-based trigger would never fire).

#### 3.3.2 Lobby / waiting-room

- **Player roster**: row per player with bird sprite, username, ready state. **Idle birds preen or look around** (one shared 3-frame idle animation; **disabled or flattened to a single static frame under `prefers-reduced-motion`**).
- **Ready indicator**: per-player check-icon when ready.
- **Host model**: the first joiner is host. **`Start Race` button visible to all but enabled only for the host**, and only when ≥ 2 players are ready. Non-hosts see a `"Waiting for {hostName} to start"` label below the disabled button.
- **Host transfer**: if host disconnects (and doesn't reconnect within 20 s), host role transfers to the next-longest-joined connected player. New host gets a `"You're the host now"` toast.
- **Room-code share affordance**: large, copyable room code with a `Copy code` button. **Clipboard fallback**: on `navigator.clipboard.writeText()` rejection or absence (insecure context, Safari permission denial), the code is auto-selected in a readonly input and a toast says `"Press Cmd/Ctrl+C to copy"`.
- **Themed empty-state copy** when alone: `"Waiting for the flock to gather…"`
- **Disconnected-during-lobby**: greyed bird with `"..."` bubble.

#### 3.3.3 Error states (closed list of 9, with sprite mapping)

| Error | Copy | Primary action | Secondary action | Sprite overlay |
|-------|------|----------------|------------------|----------------|
| `room-not-found` | "That nest is empty." | Back to lobby | — | empty-nest |
| `server-unreachable` | "The flock got lost. Trying again…" | Try again (auto-retry) | Back to home | scattered-feathers |
| `auth-expired` | "Your perch timed out. Sign back in to rejoin the flock." | Sign in | Back to home | sleeping-bird |
| `rate-limited` | "Catch your breath — too many races in a row." | Try again (backoff) | Back to home | panting-bird |
| `race-full` | "This nest is full." | Back to lobby | — | full-nest |
| `kicked-for-cheating` | "You've been disconnected for unusual activity." | Back to home | — | grounded-bird |
| `dnf-reconnect-expired` | "Lost the flock — race ended without you." | Back to lobby | View results | lone-bird |
| `websocket-blocked` | "Your network is blocking real-time play. Try a different network." | Back to home | — | tangled-wires |
| `passage-load-failed` | "Couldn't load the passage. Try again?" | Try again | Back to home | broken-egg |

Sprite vocabulary doubles as the closed list for the composable bird-base + state-overlay art (§ 3.8). Shared `useRetry({ maxAttempts: 3, backoffMs: [500, 2000, 5000] })` hook handles "Try again" buttons consistently.

#### 3.3.4 Kicked-for-cheating sequence

When the synchronous validator hits the KICK threshold mid-race:

1. Server severs the socket immediately.
2. Other players see `player_dropped` event; the kicked bird disappears from the race exactly as a normal disconnect-DNF.
3. The kicked client receives the full-screen `kicked-for-cheating` overlay. **No WPM, accuracy, or other race details are shown.** The message is intentionally generic — never reveal which check fired (avoids feedback loop for cheat-tuners; aligns with § 2.1.5 privacy posture).

### 3.4 Settings & toggles

Persistent settings popover (gear icon, top-right of every page) holds:

- **Audio mute** — `localStorage["aa.audio.muted"]`, default `true`. Mirrored to `User.audioMuted` on next save after signup.
- **Reduced motion override** — `localStorage["aa.motion.reduced"]`, default reads `prefers-reduced-motion`.
- **High contrast** — `localStorage["aa.contrast.high"]`, default `false`.

**Settings during a race**: the gear icon is **disabled and greyed out** during an active race (countdown + race-in-progress). Tooltip: `"Settings available between races."`

**In-race mute affordance**: a small mute-state icon is rendered in the race HUD (bottom-right, decorative `aria-hidden`, not in tab order). It indicates current mute state visually. **Mid-race mute toggle: `Ctrl+M`** (modifier keys are never consumed as passage characters per § 2.1.2, so this works without disrupting typing). The shortcut is documented in the shortcuts overlay (§ 3.6).

All three settings persist before login (localStorage) and after login (mirrored to `User`).

### 3.5 Combo meter mechanics (visual-only, local-only)

- **Trigger**: increments on each correct keystroke that follows another correct keystroke without an intervening typo. **First keystroke of the race goes 0→1.**
- **Reset on typo**: any incorrect keystroke resets to 0.
- **Backspace pause behavior**:
  - First backspace from an unpaused state: combo enters paused state with `pausedAtCharIndex = currentCharIndex`.
  - Additional backspaces while already paused: `pausedAtCharIndex` **stays at the earliest paused index** (does not move backward with each backspace). This way the combo only resumes after the player has corrected and re-typed past the original error point.
  - Resumes from `comboCount` when the next correct character is typed *and* `currentCharIndex > pausedAtCharIndex`.
- **Word boundaries**: combo persists across words.
- **Race transitions**: resets to 0 at race start; preserved across reconnect via § 2.3 step 6 fields (`comboCount`, `comboPaused`, `comboPausedAtCharIndex`).
- **In-race `Esc` confirmation overlay**: combo is **paused** (treated like backspace pause) while the confirmation overlay is open; resumes on dismiss. Does NOT reset. **If the player disconnects while the overlay is open, the Esc-overlay-paused state collapses into the generic paused state for the resume snapshot** (server doesn't know the overlay was open, doesn't need to — the overlay is dismissed on reconnect, and `comboPausedAtCharIndex` semantics are identical to a backspace pause).
- **Tier names** (HUD pixel-art text): **Fledgling (×1) / Flapping (×2) / Soaring (×3) / Migrating (×5) / Skyborne (×10)** at thresholds **5 / 15 / 35 / 75**. Skyborne replaces "Apex" (off-theme).
- **Effect on scoring**: **none.** Visual / motivational only.
- **Local-only**: combo state never broadcast to other players; opponents never see your tier and you never see theirs.
- **Results screen**: shows `"Best streak: {N} ({TierName})"` so every race has a takeaway.

### 3.6 Accessibility (consolidated)

- **`prefers-reduced-motion`**: when matched (or in-app override on), disable screen shake, particle trails, word-complete flash, combo glow pulse, lobby idle-bird animation. Combo tier still displays as static colored text label. Hero loop video replaced with poster image.
- **Colorblind redundancy**: combo tiers use color (glow) AND pixel-art text label. Player vs. opponent bird uses different sprites + names.
- **ARIA live regions**: two regions, **rendered via portal at `document.body` so they live outside any `inert` race surface** and remain audible to AT during overlays.
  - **Assertive** (`aria-live="assertive"` / `role="alert"`): countdown ("3, 2, 1"), race start, race end with placement, disconnect, reconnect.
  - **Polite** (`aria-live="polite"`): combo tier changes (local only), opponent finished.
- **Tab key handling**: Tab is consumed as a passage character **only** when the race input element has DOM focus AND no modifier key is held. `Shift+Tab`, modified Tab, and Tab while focused on any other element navigate normally. `Esc` is always honored. **axe-core scope** in CI excludes the typing-input element from the keyboard-trap rule (manually verified justified exception, documented in the test file).
- **Focus management**:
  - Modals / overlays trap focus. Initial focus on primary CTA; focus restored to trigger on close.
  - `Escape` closes modal/overlay where contextually meaningful; during race, `Escape` shows a confirmation overlay.
  - Race surface uses `inert` attribute when any overlay opens. **`LiveAnnouncer` is rendered outside the inert region** (portal to `document.body`) so announcements continue to fire during overlays.
- **Keyboard shortcuts**:
  - `Esc` — close modal / leave race (with confirm during race)
  - `Enter` — confirm "ready" in lobby; submit signup form on results
  - `M` — toggle mute (active in **menus only**; intercepted as a normal char during race input). When the settings popover is open and focused, `M` is handled by the popover's own toggle (single source of truth — the global handler defers to the popover).
  - `Ctrl+M` — toggle mute (active **anywhere including mid-race**, modifier not consumed as passage char per § 2.1.2).
  - `?` — open shortcuts overlay (menus only). Implemented as a key event matching `event.key === '?'` (which on US layouts requires `Shift+/`). **Layout-aware fallback**: `F1` also opens the overlay for non-US layouts where `?` requires a non-shift combo.
- **Toast stacking**: **max 3 visible toasts**, FIFO dismissal, **4 s default duration**. Assertive toasts (claim success, host transfer) get priority and prepend; polite toasts (copy-code) get appended.
- **Automated checks**: `axe-core` runs in Playwright against landing, lobby, race screen, results screen. Failures block CI.

### 3.7 Guest-to-account claim flow

- **Mid-race signup**: signup CTA is **disabled** during a race. Nav actions that would interrupt prompt the in-app `"Leave race? You'll lose your progress."` confirmation (React `onClick` handler intercepts before navigation). For tab-close / refresh, the **`beforeunload` guard** fires only when the in-app handler can't intercept (i.e., browser-native close button) — the two paths don't overlap.
- **Results-screen stash**: race result stashed to `localStorage["aa.pending-claim"]` as a **FIFO list capped at 3 entries** (oldest evicted). Each entry: `{ passageId, wpm, accuracy, clientGhostData, completedAt }`.
- **Same-session signup at results**: post-auth hook reads the list, POSTs each entry to `/api/scores/claim`. Toast: `"Saved your race(s) to your new account."`
- **Cross-session boot check**: `ClerkProvider`-mount hook in root layout reads `aa.pending-claim` on every authenticated boot. Entries with `completedAt` within **30 minutes** auto-claim and toast; older entries silently dropped.
- **Recency gate for toast**: toast fires only if `completedAt < 30 min ago` AND at least one entry was successfully claimed.

### 3.8 Files touched (Track C)

| Path | Change |
|------|--------|
| `src/components/Bird.tsx` | dynamic flap rate, currentWPM rolling window |
| `src/components/FeatherTrail.tsx` | **new** — single canvas, 20-particle cap, position from interpolated render |
| `src/components/ComboMeter.tsx` | **new** — HUD top-right, tier labels, local-only |
| `src/components/MobileChoice.tsx` | **new** — soft "continue anyway?" prompt |
| `src/components/MobileInputFallbackBanner.tsx` | **new** — § 3.3.1 (5s-after-countdown trigger) |
| `src/components/SettingsPopover.tsx` | **new** — disabled-during-race state |
| `src/components/InRaceMuteIcon.tsx` | **new** — visual-only HUD indicator |
| `src/components/ShortcutsOverlay.tsx` | **new** — `?` and `F1` triggers |
| `src/components/ErrorOverlay.tsx` | **new** — themed treatment + per-error actions + sprite overlay |
| `src/components/LiveAnnouncer.tsx` | **new** — assertive + polite regions, portaled to body |
| `src/components/Toaster.tsx` | **new** — max-3 stack, FIFO, priority |
| `src/components/HeroVideo.tsx` | **new** — `<video>` with reduced-motion → poster fallback |
| `src/components/Lobby.tsx` | rework — roster, ready, share + clipboard fallback, idle animation w/ reduced-motion gate, host model + transfer |
| `src/hooks/useAudio.ts` | **new** — gain-node pool, source-per-play, mute persistence, Ctrl+M handler |
| `src/hooks/useReducedMotion.ts` | **new** — OS pref + in-app override |
| `src/hooks/useCurrentWPM.ts` | **new** — 3-second rolling, supports both local-keystroke and interpolated-position derivations |
| `src/hooks/useRetry.ts` | **new** — shared backoff retry |
| `src/hooks/useLowEndDevice.ts` | **new** — deviceMemory ?? hardwareConcurrency |
| `src/lib/claim-result.ts` | **new** — FIFO stash, boot check, recency gate |
| `src/app/page.tsx` | landing rewrite with committed hero copy + HeroVideo |
| `src/app/play/guest/page.tsx` | **new** guest mode |
| `src/app/api/scores/claim/route.ts` | **new** — claim endpoint, accepts list |
| `prisma/schema.prisma` | add `User.audioMuted`, `User.reducedMotion`, `User.highContrast` |
| `public/audio/*.ogg` | **new** — ~6 files |
| `public/sprites/feather-puff.png` | **new** |
| `public/landing/hero.webm`, `hero.mp4`, `hero-poster.png` | **new** — hero loop |
| `public/sprites/error-states/` | **new** — committed: one composable bird base + 9 state overlays per § 3.3.3 sprite-overlay column (empty-nest, scattered-feathers, sleeping-bird, panting-bird, full-nest, grounded-bird, lone-bird, tangled-wires, broken-egg). Cheaper, more consistent voice than 9 bespoke illustrations. |

## 4. Resume & Interview Narrative

### 4.1 Resume bullet — two pre-written variants

Both variants use placeholders `{N}`, `{X}` filled only after `docs/netcode.md` commits.

**Variant A — "≥1 statistical check cleared the precision bar"**:

> **Accelerate Avians** — Real-time multiplayer typing racer (Next.js 16, Socket.IO, PostgreSQL). Built server-authoritative scoring (WPM derived from server-stamped progress events; client keystroke data is replay-only) with one or more statistical anti-cheat checks calibrated against a labeled honest/cheat corpus to ≥95% precision (keystroke-interval distribution, paste detection, WPM ceiling). Implemented client-side entity interpolation with server-clock sync for smooth opponent rendering at 10 Hz broadcast rate, plus 20-second reconnection resume with HMAC-fenced session tokens. Load-tested to 200 concurrent rooms (800 virtual typists at 8 Hz), p99 broadcast latency under 10 ms on loopback-isolated single-host infrastructure.

**Variant B — "All checks remained at LOG"**:

> **Accelerate Avians** — Real-time multiplayer typing racer (Next.js 16, Socket.IO, PostgreSQL). Built server-authoritative scoring (WPM derived from server-stamped progress events; client keystroke data is replay-only) with a corpus-calibrated statistical anti-cheat layer; checks operate in log-and-review mode pending additional honest-typing samples, with precision/recall reported per check in the writeup. Implemented client-side entity interpolation with server-clock sync for smooth opponent rendering at 10 Hz broadcast rate, plus 20-second reconnection resume with HMAC-fenced session tokens. Load-tested to 200 concurrent rooms (800 virtual typists at 8 Hz), p99 broadcast latency under 10 ms on loopback-isolated single-host infrastructure.

**Finalization gate**: variant choice + `{N}` + `{X}` filled only after both calibration test results AND `docs/netcode.md` load-test table commit. Placeholder values must never appear in any artifact submitted to a recruiter.

### 4.2 Interview talking points

1. **Hard technical problem** — entity interpolation with clock sync. Whiteboard: `serverTime` per broadcast, EMA-smoothed offset on the client, render at `now − INTERP_DELAY_MS` against bracketing samples. Discuss the dropped-packet case (extrapolate ≤150 ms, then freeze) and why freeze beats wild extrapolation. Discuss the median-of-5 cold-start handshake and why naive 5-sample averaging would be poisoned by TCP slow-start.
2. **Anti-cheat** — layered defense: cheap synchronous checks (bounds / monotonic / rate limit) at `KICK`, expensive statistical checks at `LOG`-then-promoted-after-corpus-calibration. Methodology — labeled corpus, ≥95% precision target, IME-exclusion, composed-segment cap — distinguishes you from "I made up some thresholds." Keep the kick-message generic in interviews too: never claim to detect a specific cheat by name.
3. **Scale** — load test, with honest framing of what loopback shows and what it doesn't. The `db-finalize.js` and `slow-consumer.js` scenarios discover real bottlenecks (Prisma pool, Postgres write contention, buffered-amount runaway) rather than just measuring server-side overhead.

### 4.3 `docs/netcode.md` structure

1. Problem statement
2. Server-authoritative scoring
3. Entity interpolation — timeline diagram with dropped-packet AND cold-start cases
4. Clock sync — EMA math, median-of-5 handshake
5. Anti-cheat — checks, thresholds, calibration methodology, corpus precision/recall, corpus composition disclosure
6. Reconnection protocol — sequence diagram including socket-fencing, atomic epoch increment, per-token reconnect cap
7. Load test — methodology, environment disclosure (machine, Node, Postgres, k6 versions), results table per scenario, FD-leak measurement
8. **Trade-offs considered (and rejected)**:
   - Client-side prediction + rollback — local input is already echoed; wrong problem.
   - Delta compression — payload already < 100 bytes.
   - UDP / WebRTC — at 10 Hz with reliable ordering required, browser complexity buys nothing measurable.
   - permessage-deflate — disabled; CPU cost not justified at <100-byte payloads.
   - Hard-block mobile — false-positives iPad-with-keyboard.
   - GIF for hero — ignores reduced-motion, no pause control.
   - Eyeballing anti-cheat thresholds — see § 2.1.3.
   - Vercel Cron for prune-violations — Postgres lives behind Railway server; a Vercel→Railway HTTP hop is unnecessary complexity.
   - `AudioBufferSourceNode` pooling — Web Audio spec says source nodes are single-use; pool the gain chain instead.
9. **Secrets & config** — every env var the netcode layer reads (`RESUME_TOKEN_SECRET`, `DATABASE_URL`, Clerk keys) with rotation expectations. Helps anyone forking the repo.

## 5. Validation & Testing

- **Unit tests**:
  - `cheat-detector.test.ts` — every check vs. labeled corpus; precision/recall per check; CI gate is "no per-check precision regression past previous commit."
  - `clock-sync.test.ts` — EMA convergence under simulated jitter, including median-of-5 cold start and outlier rejection.
  - `resume-token.test.ts` — HMAC mint/verify, replay, expiry, missing-secret boot failure, reconnect-cap enforcement.
  - `room-manager.test.ts` — concurrent-reconnect race against the atomic epoch SQL.
- **Integration tests**:
  - Playwright: disconnect-and-reconnect within 20 s window resuming from prior `charIndex` AND prior combo state; verify other players' progress snapshot consistent.
  - Playwright: paste in guest mode is blocked.
  - Playwright: IME composition input does not trigger paste-detection or interval false-positives.
  - Playwright: oversized composed segment (> 12 chars) triggers LOG flag.
  - Playwright: kicked-for-cheating overlay shows generic copy with no WPM.
  - Playwright + axe-core: landing, lobby, race screen, results screen pass axe (with documented race-input keyboard-trap exception).
  - Playwright keyboard-only navigation through guest-race-results-signup flow.
  - Playwright with `prefers-reduced-motion` emulated: shake/flash/particles disabled, combo tier text readable, hero shows poster, lobby idle bird flat.
  - Playwright: settings gear disabled during active race; `Ctrl+M` toggles mute mid-race without consuming as passage char.
  - Playwright: cross-session boot claim hook fires for entries within 30 min.
  - Playwright: lobby host disconnect triggers host transfer; new host sees toast.
  - Playwright: clipboard fallback (mock `navigator.clipboard` rejection) selects code and shows manual-copy toast.
- **Performance test**: synthetic 4-player race holds **p95 frame time < 20 ms** across 30 s on `ubuntu-latest`. **Retry: 2-of-3.** CI gate.
- **Load test**: standalone, results in `docs/netcode.md`. Localhost only — § 2.5.1.
- **Manual play pass**: after every meaningful polish change, a 5-minute play session asking *does this still feel good?*

## 6. Explicit Non-Goals

- ❌ Mobile gameplay (soft prompt only).
- ❌ Ranked ladder / seasons / tournaments.
- ❌ AI-generated passages / AI coach.
- ❌ Spectator mode.
- ❌ Prediction + reconciliation for *your own* typing.
- ❌ Audio beyond ~6 SFX. No music. No mixer.
- ❌ Full observability dashboard.
- ❌ Multiplayer personal-best ghost overlay.
- ❌ Multi-instance Socket.IO with Redis adapter.
- ❌ Storing raw keystroke arrays on `CheatViolation`.
- ❌ Bespoke per-error illustrations.
- ❌ Server-side orphan-claim queue (localStorage stash + boot check is sufficient).
- ❌ Broadcasting combo state to opponents (local-only by design).
- ❌ Vercel Cron for pruning (Railway scheduler instead).

## 7. Rollout Order & Time Budget

Solo-author estimates, calendar days at ~4 focused hours/day.

| Phase | Scope | Estimate |
|-------|-------|----------|
| 1 | Server-authoritative scoring (§ 2.0) — extract `serverGhost`, demote client `ghostData`, schema update. | 2–3 days |
| 2 | Reconnection + opponent interpolation + clock sync + transport pinning (§ 2.2 + § 2.3 + § 2.4). | 3–4 days |
| 3 | **Load test** + writeup of measured numbers (§ 2.5). Localhost only. | 2–3 days |
| 4 | Anti-cheat layer + corpus collection + calibration (§ 2.1). Ship at LOG; promote per § 2.1.3 if precision clears. | 3–5 days |
| 5 | Polish — guest mode + landing rewrite first, then juice + audio, then settings + accessibility, then error/loading states + lobby treatment. | 5–7 days |
| 6 | Writeup — `docs/netcode.md` finalized, README refresh, resume bullet variant chosen and `{N}`/`{X}` filled. | 1 day |

**Total: ~16–23 calendar days.**

Phases 3 (load test) and 4 (anti-cheat) deliberately ordered with load test first — load test has no external dependency and produces a defensible bullet number even if anti-cheat corpus stalls. If polish (Phase 5) compresses past 7 days, cut from § 3.3.3 nice-to-haves before cutting from juice or accessibility.

Each phase ends with manual play-through + a commit. Ship frequently; don't batch.

### 7.1 Week-1 Minimum Viable Improvement

If a recruiter screen lands before Phase 5 completes, **Phases 1 + 2 alone** ship as a credible standalone resume-bullet update in ~5–7 days:

> **Accelerate Avians** — Real-time multiplayer typing racer (Next.js 16, Socket.IO, PostgreSQL). Refactored to server-authoritative scoring (WPM derived from server-stamped progress events; client keystroke data is replay-only). Implemented client-side entity interpolation with server-clock sync for smooth opponent rendering, plus 20-second reconnection resume with HMAC-fenced session tokens. Anti-cheat layer and load testing in progress.

**Decision rule**: if the recruiter screen is scheduled before Phase 4 completes, send the Phase-1+2 version with a link to `docs/netcode.md` (which by then includes server-authority + interpolation + reconnection sections).

## 8. Operational Safety & Budget

### 8.1 Load test safety

- See § 2.5.1 — allowlist (localhost only), hard duration cap, lockfile guard.

### 8.2 Hosting cost ceiling & enforcement

- Soft cap: **$25/month** for Railway + Vercel combined.
- **Enforcement**:
  - Railway project: usage alert at $20.
  - Vercel: spend cap set to $25/month in dashboard.
  - **Runbook** (`docs/runbook.md`, new): if Railway alert fires, disable Railway service. **If Vercel spend cap fires, the maintenance page falls back to a static HTML file served from a separate Vercel project (`accelerate-avians-maintenance`)** — Vercel's spend cap hard-stops *functions* in the affected project, so the maintenance page cannot live in the same project. Documented runbook step: switch DNS to the maintenance project.
- Current deploy is Railway hobby (free) + Vercel hobby (free). At 200 sustained concurrent rooms, Railway hobby may not suffice; bullet's measured-not-hosted framing is intentional (§ 4.1).
- Document in README: `"Capacity is measured in load test; hosted tier supports ~{Y} concurrent rooms before requiring a paid Railway plan."` `{Y}` filled after Phase 3.

### 8.3 Privacy & data retention

- `CheatViolation` rows pruned at 30 days (§ 2.1.5).
- `Score.serverGhost` retained only for flagged scores; nulled at 30 days.
- No raw keystroke arrays on `CheatViolation`.
- Disclosure in README + in-app footer: `"We log anti-cheat signals (timing statistics, not keystroke content) for 30 days."`

### 8.4 Next.js 16 conventions

Per `AGENTS.md`: Next.js 16 with breaking changes. New routes and the landing rewrite must follow current App Router and Cache Components conventions (`use cache`, `cacheLife`, `cacheTag`). Confirm against `node_modules/next/dist/docs/` before each new route. Live counter explicitly uses `use cache` + `cacheLife({ stale: 60, revalidate: 300 })`.

### 8.5 Secret management

- **`RESUME_TOKEN_SECRET`** — HMAC secret for `resumeToken`. Required env var; server boot fails if missing or shorter than 32 bytes. Generate with `openssl rand -hex 32`. Rotation invalidates in-flight tokens; acceptable.
- **Clerk keys** — `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` per Clerk docs.
- **`DATABASE_URL`** — standard Prisma.
- **Discipline**: **`.env` is never committed to the repo. `.env.example` IS committed and carries placeholders only.** Documented in `docs/netcode.md` § 9 (Secrets & config).
