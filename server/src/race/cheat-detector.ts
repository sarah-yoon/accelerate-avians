import type { ServerGhostPoint } from "../types.js";

/**
 * Spec § 2.1 — post-race statistical anti-cheat. All checks operate on
 * `serverGhost` (server-stamped arrivals from Phase 1), never on
 * client-supplied `ghostData`. Each check is pure and returns a result
 * plus the single aggregate numeric that triggered the flag (stored on
 * CheatViolation.numericValue — NOT the raw keystroke array).
 *
 * Thresholds are starting values. Promotion past LOG requires ≥ 95%
 * precision on the labeled corpus (spec § 2.1.3).
 */

export type CheckName =
  | "min-interval"
  | "interval-stddev"
  | "first-burst-paste"
  | "jump"
  | "wpm-ceiling";

export interface CheckResult {
  check: CheckName;
  triggered: boolean;
  numericValue: number;
}

export const THRESHOLDS = {
  MIN_INTERVAL_MS: 12,
  STDDEV_LOWER_MS: 10,
  STDDEV_WINDOW: 30,
  STDDEV_MEAN_GATE_MS: 50,
  FIRST_BURST_CHAR_COUNT: 20,
  FIRST_BURST_UPDATE_COUNT: 2,
  JUMP_AFTER_MS: 1000,
  JUMP_MAX_CHARS: 5,
  WPM_CEILING: 220,
} as const;

/**
 * Derive per-update char advances from a serverGhost. Each ghost entry
 * corresponds to one `typing-progress` message; the char-advance for
 * message i is `charIndex[i] - charIndex[i-1]`. A paste shows up here
 * as a large single value (e.g. [30, 1, 1, 1, ...]).
 */
export function bucketsFromGhost(serverGhost: ServerGhostPoint[]): number[] {
  const out: number[] = [];
  let prev = 0;
  for (const g of serverGhost) {
    const delta = g.charIndex - prev;
    if (delta > 0) out.push(delta);
    prev = g.charIndex;
  }
  return out;
}

/** Inter-keystroke intervals (ms) derived from monotonically-arriving samples. */
export function intervalsOf(serverGhost: ServerGhostPoint[]): number[] {
  if (serverGhost.length < 2) return [];
  const out: number[] = [];
  for (let i = 1; i < serverGhost.length; i++) {
    const dt = serverGhost[i].serverMs - serverGhost[i - 1].serverMs;
    if (dt >= 0) out.push(dt);
  }
  return out;
}

/**
 * Flag if any interval is below a plausible-human threshold.
 * Expected false-positive source: mechanical-keyboard rollover on common
 * bigrams, so 12 ms (not 15) keeps honest fast-typists safe while still
 * catching macros.
 */
export function checkMinInterval(serverGhost: ServerGhostPoint[]): CheckResult {
  const intervals = intervalsOf(serverGhost);
  if (intervals.length === 0) {
    return { check: "min-interval", triggered: false, numericValue: 0 };
  }
  const min = Math.min(...intervals);
  return {
    check: "min-interval",
    triggered: min < THRESHOLDS.MIN_INTERVAL_MS,
    numericValue: min,
  };
}

/**
 * Flag uniform-timing (bot-like) bursts: any 30-keystroke rolling window
 * where stddev < 10 ms AND mean > 50 ms. The mean gate avoids flagging
 * legitimate fast bursts — real fast typists have variance even at 180+
 * keystrokes/s.
 */
export function checkIntervalStability(
  serverGhost: ServerGhostPoint[]
): CheckResult {
  const intervals = intervalsOf(serverGhost);
  if (intervals.length < THRESHOLDS.STDDEV_WINDOW) {
    return { check: "interval-stddev", triggered: false, numericValue: 0 };
  }
  let minStddev = Infinity;
  let matched = false;
  for (let i = 0; i + THRESHOLDS.STDDEV_WINDOW <= intervals.length; i++) {
    const slice = intervals.slice(i, i + THRESHOLDS.STDDEV_WINDOW);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance =
      slice.reduce((a, b) => a + (b - mean) * (b - mean), 0) / slice.length;
    const stddev = Math.sqrt(variance);
    if (stddev < minStddev) minStddev = stddev;
    if (
      stddev < THRESHOLDS.STDDEV_LOWER_MS &&
      mean > THRESHOLDS.STDDEV_MEAN_GATE_MS
    ) {
      matched = true;
    }
  }
  return {
    check: "interval-stddev",
    triggered: matched,
    numericValue: Number.isFinite(minStddev) ? minStddev : 0,
  };
}

/**
 * Flag if the first N `progress_update` messages after race start delivered
 * ≥ 20 chars. A paste registers as a single update containing all pasted
 * characters; a real typist needs 20 keystrokes → 20 updates for this volume.
 *
 * Takes a pre-derived array of { updateIndex, charsAdvanced } since the
 * raw serverGhost doesn't carry update boundaries on its own — callers
 * (race-controller) build this array when sampling.
 */
export function checkFirstBurstPaste(
  updateBuckets: number[]
): CheckResult {
  if (updateBuckets.length < THRESHOLDS.FIRST_BURST_UPDATE_COUNT) {
    return {
      check: "first-burst-paste",
      triggered: false,
      numericValue: 0,
    };
  }
  const firstTwo = updateBuckets
    .slice(0, THRESHOLDS.FIRST_BURST_UPDATE_COUNT)
    .reduce((a, b) => a + b, 0);
  return {
    check: "first-burst-paste",
    triggered: firstTwo >= THRESHOLDS.FIRST_BURST_CHAR_COUNT,
    numericValue: firstTwo,
  };
}

/**
 * Flag single samples that advance `charIndex` by > 5 chars after the
 * first 1 s. Early-race bursts are common on passage-begin focus so the
 * first second is excluded.
 */
export function checkJump(serverGhost: ServerGhostPoint[]): CheckResult {
  let maxJump = 0;
  let triggered = false;
  for (let i = 1; i < serverGhost.length; i++) {
    const prev = serverGhost[i - 1];
    const cur = serverGhost[i];
    if (cur.serverMs <= THRESHOLDS.JUMP_AFTER_MS) continue;
    const jump = cur.charIndex - prev.charIndex;
    if (jump > maxJump) maxJump = jump;
    if (jump > THRESHOLDS.JUMP_MAX_CHARS) triggered = true;
  }
  return { check: "jump", triggered, numericValue: maxJump };
}

/**
 * Flag a final WPM above the realistic human ceiling. World-record runs
 * over short passages have hit ~256 net WPM, but the submitted race path
 * runs long-tail passages where sustained > 220 WPM is essentially a
 * signal for manual review. LOG-only.
 */
export function checkWpmCeiling(wpm: number): CheckResult {
  return {
    check: "wpm-ceiling",
    triggered: wpm > THRESHOLDS.WPM_CEILING,
    numericValue: wpm,
  };
}

export interface DetectorInput {
  serverGhost: ServerGhostPoint[];
  updateBuckets: number[]; // chars advanced per progress_update, in order
  wpm: number;
}

/** Run every check; return the array of results (flagged + not flagged). */
export function runAllChecks(input: DetectorInput): CheckResult[] {
  return [
    checkMinInterval(input.serverGhost),
    checkIntervalStability(input.serverGhost),
    checkFirstBurstPaste(input.updateBuckets),
    checkJump(input.serverGhost),
    checkWpmCeiling(input.wpm),
  ];
}
