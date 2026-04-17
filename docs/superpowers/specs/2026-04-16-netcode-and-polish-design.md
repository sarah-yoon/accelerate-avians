# Accelerate Avians — Netcode Hardening & Polish Pass

**Date:** 2026-04-16
**Author:** Sarah Yoon
**Goal:** Elevate Accelerate Avians into a portfolio piece strong enough to carry a new-grad SWE interview at Amazon Games — specifically, producing one deep multiplayer-engineering story plus a first-impression polish layer that hooks a recruiter in under 30 seconds.

---

## 1. Outcome

After this work lands:

1. A recruiter clicking the deploy link is playing a typing race within ~15 seconds (guest mode, no signup), and the game *feels* good (juice, audio, animation).
2. Three interview-ready technical stories exist:
   - Server-authoritative statistical anti-cheat
   - Client-side entity interpolation
   - Load test with measured p50/p99 broadcast latency
3. A concise `docs/netcode.md` writeup is linked from the README and can be sent to the technical panel.
4. Resume bullet is truthful and specific — every claim is backed by code shipped and numbers measured.

Explicitly *not* goals: mobile gameplay, ranked ladders, AI features, spectator mode. See § 6.

## 2. Track A — Netcode & Anti-cheat

### 2.1 Expanded anti-cheat

Current checks (in `server/src/race/progress-validator.ts`): charIndex bounds, monotonic increase, rate limit of 30 updates/sec.

Add, in a new `server/src/race/cheat-detector.ts`:

- **Keystroke-interval statistics** — computed post-race from `ghostData`:
  - Flag if `min(intervals) < 15 ms` across any two consecutive keystrokes (superhuman)
  - Flag if `stddev(intervals) < 8 ms` over any 30-keystroke window (bot-like uniformity)
  - Flag first-burst paste: ≥20 chars submitted within the first two progress updates after race start
- **WPM ceiling** — final `wpm > 220` is auto-flagged. World record sits around 230 WPM; sustained real-player performance above 200 is exceedingly rare.
- **Per-update jump check** — after the first second of racing, any single progress update gaining more than 5 chars is flagged. This is generous: 7–10 chars/sec is elite, and broadcasts arrive at 10 Hz.

**Enforcement policy** — graduated:

| Level | Behavior |
|-------|----------|
| `LOG` | Store violation, accept score normally |
| `INVALIDATE` | Accept race result but set `score.flagged = true`, exclude from leaderboards |
| `KICK` | Disconnect player mid-race (reserved for synchronous checks only) |

All new statistical checks ship at `LOG` level. Once a week of data confirms low false-positive rate, promote individually to `INVALIDATE`. The existing synchronous validator (bounds / monotonic / rate-limit) will be wired through the connection handler to enforce `KICK` — today it returns a `ValidationResult` that callers ignore at the `KICK` level, so this wiring is part of the work.

Every violation emits:

```ts
{ type: "cheat_violation", userId, matchId, check, value, action, detectedAt }
```

Persisted to a new `CheatViolation` Prisma model. Acts as free analytics data for Section 4 of README writeup.

### 2.2 Opponent interpolation (client-side)

**Problem:** Server broadcasts opponent progress at ~10 Hz. Client currently snaps opponent birds to new positions → visible jitter.

**Approach — standard entity interpolation (Valve pattern):**

- Each opponent's progress samples are pushed into a small FIFO buffer with `receivedAt` timestamps.
- The renderer always draws each opponent `INTERP_DELAY_MS = 120` behind the current client time.
- Rendered progress = `lerp(sampleA, sampleB, t)` where `sampleA` and `sampleB` bracket the render time.
- If the buffer underflows (no future sample), extrapolate briefly (≤50 ms) then freeze until a new sample arrives.

Implemented as:

- `src/hooks/useInterpolatedProgress.ts` — hook returning smoothed progress for a given opponent userId
- `src/components/OpponentBird.tsx` — consume the hook

Local player's own bird is *not* interpolated — their input is echoed immediately (their progress is the ground truth on their own screen).

### 2.3 Reconnection / resume

**Problem:** Any disconnect mid-race = DNF. Real online games tolerate brief drops.

**Approach:**

- On `disconnect`, room manager retains the player's seat and `lastCharIndex` for `RECONNECT_WINDOW_MS = 10_000`. Player is marked `isConnected = false`.
- Server broadcasts `player_disconnected` → UI greys the bird with a "..." bubble.
- If the same Clerk userId reconnects to the same room within the window, server sends `resume_state { charIndex, raceElapsedMs }` and flips `isConnected = true`. UI restores color.
- After the window expires without reconnect, player is marked DNF, broadcast `player_dropped`, race proceeds.
- Race ends when all *connected* players finish OR the existing race timeout fires.

Files: `server/src/handlers/connection-handler.ts`, `server/src/rooms/room-manager.ts`.

### 2.4 Load test

Script: `scripts/load-test.ts` using [k6](https://k6.io) (preferred) or Artillery.

- Spawns `N` virtual clients via WebSocket
- Groups them into rooms of 4, each playing a synthetic 60-second race with realistic progress update rate (6–10 Hz)
- Measures:
  - `broadcast_latency_ms` — time from one client's progress message to all other clients in the same room receiving it
  - `message_drop_rate`
  - Server-side CPU and RSS sampled every 5 s
- Runs at 50 / 100 / 200 / 400 concurrent rooms

Results written to `docs/netcode.md` as a table. Reference it from the README.

### 2.5 Files touched (Track A)

| Path | Change |
|------|--------|
| `server/src/race/progress-validator.ts` | (unchanged — already covers synchronous checks) |
| `server/src/race/cheat-detector.ts` | **new** — post-race statistical analysis |
| `server/src/race/race-controller.ts` | call cheat-detector on `playerFinished` |
| `server/src/handlers/connection-handler.ts` | reconnection window logic |
| `server/src/rooms/room-manager.ts` | preserve disconnected player state |
| `src/hooks/useInterpolatedProgress.ts` | **new** |
| `src/components/OpponentBird.tsx` | consume interpolated progress |
| `prisma/schema.prisma` | **new** `CheatViolation` model, `Score.flagged` field |
| `scripts/load-test.ts` | **new** |
| `docs/netcode.md` | **new** — writeup with tables and diagrams |

## 3. Track C — Polish Pass

### 3.1 Juice

- **Word-complete flash**: on finishing a word with ≥95% accuracy, overlay a white flash on the passage (opacity 0.15 → 0 over 180 ms) plus a 2–3 px screen shake lasting 80 ms.
- **Combo meter**: consecutive correct chars without error → multiplier tiers at 10 / 25 / 50 / 100 (`x2 / x3 / x5 / x10`). Each tier adds a CSS `filter: drop-shadow(...)` glow around your bird. Breaks on any typo.
- **Bird particle trail**: a dust-puff sprite emitted behind your bird. Emission interval = `clamp(1000 / (currentWPM / 20), 80, 1200) ms`. Result: at 120 WPM, a continuous trail; at 40 WPM, sparse puffs.
- **Wing-flap rate**: existing bird sprite animation speed is static. Change to `flapFPS = clamp(currentWPM / 15, 4, 12)`. At 60 WPM flap is lively; at 120 WPM it's frantic.

### 3.2 Audio

Small palette, tasteful, **muted by default** with a single toggle stored in `localStorage`.

- Correct-key click — 3 samples, pitch jittered ±5%
- Incorrect-key soft thud
- Countdown chirps (3-2-1)
- Race-finish ascending arpeggio (short)
- Opponent-finished cue (a small chime, only for the first one to finish ahead of you, so it doesn't get noisy)

Implementation: `src/hooks/useAudio.ts` wrapping Web Audio API with a small sample pool. Samples either from freesound.org (CC0) or synthesized with `tone.js`.

### 3.3 First-impression polish

- **Guest mode** — `src/app/play/guest/page.tsx`. Lands directly into a 45-second solo race against a scripted ghost. No signup. Score not persisted. Signup CTA appears *only* on the results screen ("Sign up to save your best time and race friends").
- **Landing-page rewrite** — single hero: big `Play Now` button, live counter ("X races played, Y total words typed"), a single 4-second looping video/gif of a race. Everything else (features, leaderboard) goes below the fold. Current landing page content rearranged, not thrown away.
- **Loading states** — every suspense boundary uses a desaturated pulsing pixel-art bird sprite instead of blank/spinner.
- **Mobile block** — detect `matchMedia("(pointer: coarse)")`. Show a themed `"Please come back on a laptop — our birds need a real keyboard"` screen with the game's art style.
- **Error states** — replace raw error messages with themed variants. Room-not-found, server-unreachable, auth-expired each get a custom illustration + one-liner.

### 3.4 Files touched (Track C)

| Path | Change |
|------|--------|
| `src/components/Bird.tsx` | dynamic flap rate |
| `src/components/ParticleTrail.tsx` | **new** |
| `src/components/ComboMeter.tsx` | **new** |
| `src/components/MobileBlock.tsx` | **new** |
| `src/hooks/useAudio.ts` | **new** |
| `src/app/page.tsx` | landing-page rewrite |
| `src/app/play/guest/page.tsx` | **new** guest mode |
| `public/audio/*.ogg` | **new** — ~6 files |
| `public/sprites/dust-puff.png` | **new** |

## 4. Resume & Interview Narrative

### Resume bullet (target)

> **Accelerate Avians** — Real-time multiplayer typing racer (Next.js 16, Socket.IO, PostgreSQL). Built server-authoritative netcode with statistical anti-cheat (keystroke-interval distribution analysis, paste detection, WPM ceiling), client-side entity interpolation for smooth opponent rendering at 10 Hz broadcast rate, and 10-second reconnection resume. Load-tested to 200 concurrent rooms with p99 broadcast latency under 25 ms.

### Interview talking points

1. **Hard technical problem** — entity interpolation. Can draw the timeline on a whiteboard: buffered samples, render delay, lerp between two authoritative snapshots. Contrast with the naïve "just snap to latest" and with the over-engineered "full client prediction + rollback" which is wrong for this game because your own input is locally echoed.
2. **Anti-cheat** — layered defense: cheap synchronous checks (bounds / monotonic / rate-limit) run per-message, expensive statistical checks (keystroke-interval stddev, first-burst paste, WPM ceiling) run once at finish. Graduated enforcement starting at log-only to avoid false-positive user harm.
3. **Thinking about scale** — load test with real numbers. Ran 50 / 100 / 200 / 400 concurrent rooms, measured p50/p99, identified the bottleneck (likely Socket.IO broadcast fanout), wrote it up honestly.

### `docs/netcode.md` structure

1. Problem statement
2. Entity interpolation — with timeline diagram (ASCII or SVG)
3. Anti-cheat — table of checks with thresholds and rationale
4. Reconnection protocol — sequence diagram
5. Load test methodology and results table

## 5. Validation / Testing

- **Unit tests** — each new anti-cheat check has a test with a crafted ghost-data fixture that should/shouldn't trip it. Target: false positive rate < 1% on the team's own manually-typed fixtures.
- **Integration tests** — Playwright scenario for disconnect-and-reconnect within the 10 s window resuming from prior charIndex.
- **Load test** — runs as a standalone script, results committed to `docs/netcode.md`. Re-run before any big server change.
- **Manual play pass** — after every meaningful polish change, a 5-minute play session. The question: *does this still feel good?*

## 6. Explicit Non-Goals

- ❌ Mobile gameplay — typing on mobile is a broken UX. Block screen only.
- ❌ Ranked ladder / seasons / tournaments — large feature, weak differentiation for "game dev" signal.
- ❌ AI-generated passages / AI coach — risks feeling tacked-on; not central to the product.
- ❌ Spectator mode — deceptively large (auth, replay throttling).
- ❌ Prediction + reconciliation for *your own* typing — wrong problem; your keystrokes are locally echoed with zero perceived latency.
- ❌ Audio beyond ~6 SFX (no music, no mixer).
- ❌ Full observability dashboard — the load-test writeup covers the "thought about production" signal.

## 7. Rollout Order

1. **Netcode foundation** — reconnection + opponent interpolation. Biggest visible improvement during manual play.
2. **Anti-cheat layer** — expanded checks + `CheatViolation` model, shipped at `LOG` level.
3. **Load test** — run locally, commit results doc.
4. **Polish pass** — guest mode first (first-impression impact), then juice + audio, then mobile block + error states.
5. **Writeup** — `docs/netcode.md`, README rewrite, resume bullet finalization.

Each phase ends with manual play-through + a commit. Ship frequently; don't batch.
