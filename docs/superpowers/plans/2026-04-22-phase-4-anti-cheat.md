# Phase 4 — Anti-Cheat Corpus Calibration

**Goal:** Ship a corpus-calibrated statistical anti-cheat layer. Five checks run against the post-race `serverGhost` built in Phase 1. Each check has a threshold; checks that clear ≥ 95% precision on a labeled corpus may be promoted past LOG-only. Checks that can't clear the bar stay at LOG indefinitely and are documented as "review signals, not enforcement."

**Spec:** § 2.1 of `docs/superpowers/specs/2026-04-16-netcode-and-polish-design.md`.

**Dependencies:** Phase 1 shipped `Score.flagged`, `Score.serverGhost`, and the server-authoritative `serverGhost` construction. Phase 4 adds the detector + `CheatViolation` table + calibration harness.

**Scope cuts (honest):**
- **Multi-typist corpus collection** — Sarah can record honest samples herself; spec permits single-typist corpus with explicit disclosure. Aalto 136M Keystrokes Dataset integration is a stretch goal; if time-constrained, disclose in the writeup.
- **Client-side `composed: true` IME flag wiring** — spec § 2.1.2 calls for the client to tag composed-char messages. That's Phase 4.2; for now, all progress events are treated as non-composed. Honest failure mode: IME users may false-positive the interval distribution check, so that check stays at LOG.
- **`scripts/prune-violations.ts`** — 30-day retention job. Moved to Phase 4.2.

---

## Tasks

### T1: `CheatViolation` Prisma model + migration
- Add model to both schemas (root + server)
- Fields: `id`, `userId`, `matchId?`, `scoreId?`, `check` (string enum), `severity` (float ≥ 0), `numericValue` (float — the single aggregate that triggered the flag; NOT raw keystroke arrays), `action` (enum: `LOG` / `INVALIDATE` / `KICK`), `createdAt`
- Indexes: `[userId, createdAt]`, `[check, createdAt]`
- `@@map("cheat_violations")`

### T2: `server/src/race/cheat-detector.ts`
Pure functions, one per check. Each returns `{ triggered: boolean; value: number }` or null-if-not-applicable:

- `checkMinInterval(serverGhost)` — flag if `min(intervals) < 12`
- `checkIntervalStability(serverGhost)` — rolling 30-keystroke window; flag if `stddev < 10 ms` AND `mean > 50 ms`
- `checkFirstBurstPaste(progressUpdates)` — ≥ 20 chars in first 2 updates; operates on update-count data, not sample intervals
- `checkJump(serverGhost, passageLength)` — after first 1000 ms, any single sample advancing > 5 chars
- `checkWpmCeiling(wpm)` — `wpm > 220`

Plus `runAllChecks(input)` that returns an array of flagged checks.

### T3: Fixture builder `server/test/fixtures/cheat-corpus/`
- `honest/` — synthesized honest typing samples across WPM tiers (40, 60, 80, 100, 120, 140 WPM) with realistic inter-keystroke jitter (Gaussian noise, stddev ~30ms). 6 samples minimum.
- `cheat/` — synthesized cheat samples per check:
  - paste: 30 chars in a single update
  - uniform-bot: perfectly-periodic keystrokes, 100ms apart
  - macro-paced: tight stddev < 5ms over 30+ keystrokes
  - jump: 10-char advance in a single sample after 2s
  - wpm-ceiling: sustained 250 WPM
- Two `.json` files: `honest-samples.json` and `cheat-samples.json`, each an array of typed records.

### T4: `cheat-detector.test.ts`
- One describe block per check
- Each check tested against: known honest samples (should NOT trigger), known cheat samples (SHOULD trigger)
- Aggregate test that reports precision per check (tp / (tp + fp)) against the full corpus

### T5: `scripts/calibration.ts`
Standalone script that loads the corpus, runs all checks, prints a precision/recall table:

```
| Check             | Precision | Recall | Promotable (≥95% precision) |
|-------------------|-----------|--------|-----------------------------|
| min-interval      | 88%       | 100%   | No — stays at LOG           |
| interval-stddev   | 100%      | 85%    | Yes                         |
| first-burst-paste | 100%      | 100%   | Yes                         |
| jump              | 95%       | 100%   | Yes                         |
| wpm-ceiling       | 100%      | 100%   | Yes                         |
```

Results committed to `docs/netcode.md` § 5.

### T6: Wire detector into `race-handlers.ts` `player-finished`
- After the existing `raceController.playerFinished(...)` call, run `runAllChecks(...)` against the finished player's `serverGhost`.
- For each triggered check, `prisma.cheatViolation.create({...})` with action = LOG.
- If the measured precision in T5 for a given check ≥ 95%, the action may be INVALIDATE (which also sets `score.flagged = true` on the MatchPlayer row). Hard-code the promotion list in a single constant `PROMOTED_CHECKS: Set<string>` initialized from T5 results.
- Per-match cap: at most 5 violations per (userId, matchId). Use a Set in-memory for the finish path; don't rely on DB constraint.

### T7: Update `docs/netcode.md` § 5
Replace the current "pending" placeholder with:
- Methodology (labeled corpus, ≥95% precision gate)
- Corpus composition disclosure (single-typist synthesized; multi-typist is future work)
- Per-check precision/recall table from T5
- Which checks are promoted vs LOG-only

### T8: Tag + merge
- `git tag -a phase-4-anti-cheat -m "Phase 4 complete: corpus-calibrated statistical anti-cheat"`
- Merge to main

---

## Non-goals

- ❌ Multi-typist corpus collection
- ❌ Client-side composition-flag wiring (Phase 4.2)
- ❌ `prune-violations.ts` retention job (Phase 4.2)
- ❌ CheatViolation analytics dashboard
- ❌ KICK-level enforcement from statistical checks (synchronous validator in Phase 1 already handles KICK for bounds/monotonic/rate)
