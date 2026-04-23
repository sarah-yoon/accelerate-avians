import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runAllChecks,
  checkMinInterval,
  checkIntervalStability,
  checkFirstBurstPaste,
  checkJump,
  checkWpmCeiling,
  intervalsOf,
  type CheckName,
} from "./cheat-detector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Sample {
  label: string;
  serverGhost: Array<{ charIndex: number; serverMs: number }>;
  updateBuckets: number[];
  wpm: number;
}

const honest: Sample[] = JSON.parse(
  readFileSync(
    join(__dirname, "../../test/fixtures/cheat-corpus/honest-samples.json"),
    "utf8"
  )
);
const cheat: Sample[] = JSON.parse(
  readFileSync(
    join(__dirname, "../../test/fixtures/cheat-corpus/cheat-samples.json"),
    "utf8"
  )
);

describe("intervalsOf", () => {
  it("returns pairwise diffs of serverMs", () => {
    expect(
      intervalsOf([
        { charIndex: 1, serverMs: 100 },
        { charIndex: 2, serverMs: 250 },
        { charIndex: 3, serverMs: 400 },
      ])
    ).toEqual([150, 150]);
  });
  it("returns [] for < 2 samples", () => {
    expect(intervalsOf([])).toEqual([]);
    expect(intervalsOf([{ charIndex: 1, serverMs: 0 }])).toEqual([]);
  });
});

describe("checkMinInterval", () => {
  it("does NOT trigger on honest slow typing", () => {
    const r = checkMinInterval(honest[0].serverGhost);
    expect(r.triggered).toBe(false);
  });
  it("triggers on a crammed paste (sub-12ms intervals)", () => {
    const pasteSample = cheat.find((s) => s.label.startsWith("cheat-paste"))!;
    const r = checkMinInterval(pasteSample.serverGhost);
    expect(r.triggered).toBe(true);
    expect(r.numericValue).toBeLessThan(12);
  });
});

describe("checkIntervalStability", () => {
  it("does NOT trigger on honest typing", () => {
    const r = checkIntervalStability(honest[0].serverGhost);
    expect(r.triggered).toBe(false);
  });
  it("triggers on a macro-paced trace (tight stddev, mean > 50ms)", () => {
    const macro = cheat.find((s) => s.label.startsWith("cheat-macro"))!;
    const r = checkIntervalStability(macro.serverGhost);
    expect(r.triggered).toBe(true);
  });
});

describe("checkFirstBurstPaste", () => {
  it("does NOT trigger on realistic 8Hz updates", () => {
    const r = checkFirstBurstPaste(honest[0].updateBuckets);
    expect(r.triggered).toBe(false);
  });
  it("triggers when first two updates carry ≥ 20 chars", () => {
    const paste = cheat.find((s) => s.label.startsWith("cheat-paste"))!;
    const r = checkFirstBurstPaste(paste.updateBuckets);
    expect(r.triggered).toBe(true);
    expect(r.numericValue).toBeGreaterThanOrEqual(20);
  });
});

describe("checkJump", () => {
  it("does NOT trigger on honest typing", () => {
    const r = checkJump(honest[0].serverGhost);
    expect(r.triggered).toBe(false);
  });
  it("triggers on a > 5-char advance after 1s", () => {
    const jump = cheat.find((s) => s.label.startsWith("cheat-jump"))!;
    const r = checkJump(jump.serverGhost);
    expect(r.triggered).toBe(true);
    expect(r.numericValue).toBeGreaterThan(5);
  });
});

describe("checkWpmCeiling", () => {
  it("does NOT trigger at 140 WPM", () => {
    expect(checkWpmCeiling(140).triggered).toBe(false);
  });
  it("triggers at 250 WPM", () => {
    expect(checkWpmCeiling(250).triggered).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Corpus-wide precision/recall — the headline metric per spec § 2.1.3.
// ─────────────────────────────────────────────────────────────────────────────

interface Confusion {
  tp: number;
  fp: number;
  fn: number;
}

function confusionFor(
  check: CheckName,
  honestSet: Sample[],
  cheatSet: Sample[],
  matchesLabel: (label: string) => boolean
): Confusion {
  let tp = 0;
  let fp = 0;
  let fn = 0;

  for (const s of honestSet) {
    const results = runAllChecks({
      serverGhost: s.serverGhost,
      updateBuckets: s.updateBuckets,
      wpm: s.wpm,
    });
    const result = results.find((r) => r.check === check)!;
    if (result.triggered) fp++;
  }
  for (const s of cheatSet) {
    const relevant = matchesLabel(s.label);
    const results = runAllChecks({
      serverGhost: s.serverGhost,
      updateBuckets: s.updateBuckets,
      wpm: s.wpm,
    });
    const result = results.find((r) => r.check === check)!;
    if (relevant && result.triggered) tp++;
    else if (relevant && !result.triggered) fn++;
    // Non-relevant cheat samples are ignored — each check is evaluated only
    // against the class of cheat it's designed to catch.
  }
  return { tp, fp, fn };
}

function precision({ tp, fp }: Confusion): number {
  return tp + fp === 0 ? 1 : tp / (tp + fp);
}

function recall({ tp, fn }: Confusion): number {
  return tp + fn === 0 ? 0 : tp / (tp + fn);
}

describe("corpus precision/recall", () => {
  const cases: Array<{
    check: CheckName;
    labelMatcher: (label: string) => boolean;
    minPrecision: number;
    minRecall: number;
  }> = [
    {
      check: "min-interval",
      labelMatcher: (l) => l.startsWith("cheat-paste") || l.startsWith("cheat-uniform-"),
      minPrecision: 0.95,
      minRecall: 0.5, // uniform-bot at 100ms doesn't violate min; paste does
    },
    {
      check: "interval-stddev",
      labelMatcher: (l) => l.startsWith("cheat-uniform") || l.startsWith("cheat-macro"),
      minPrecision: 0.95,
      minRecall: 0.9,
    },
    {
      check: "first-burst-paste",
      labelMatcher: (l) => l.startsWith("cheat-paste"),
      minPrecision: 0.95,
      minRecall: 1.0,
    },
    {
      check: "jump",
      labelMatcher: (l) => l.startsWith("cheat-jump"),
      minPrecision: 0.95,
      minRecall: 1.0,
    },
    {
      check: "wpm-ceiling",
      labelMatcher: (l) => l.startsWith("cheat-wpm"),
      minPrecision: 0.95,
      minRecall: 1.0,
    },
  ];

  for (const c of cases) {
    it(`${c.check}: precision ≥ ${(c.minPrecision * 100).toFixed(0)}% & recall ≥ ${(c.minRecall * 100).toFixed(0)}%`, () => {
      const confusion = confusionFor(c.check, honest, cheat, c.labelMatcher);
      const p = precision(confusion);
      const r = recall(confusion);
      // Log so the calibration script can harvest these too
      // eslint-disable-next-line no-console
      console.log(`  ${c.check.padEnd(20)} TP=${confusion.tp} FP=${confusion.fp} FN=${confusion.fn} → precision=${(p * 100).toFixed(1)}% recall=${(r * 100).toFixed(1)}%`);
      expect(p).toBeGreaterThanOrEqual(c.minPrecision);
      expect(r).toBeGreaterThanOrEqual(c.minRecall);
    });
  }
});
