#!/usr/bin/env tsx
/**
 * Synthesize a labeled cheat-detection corpus.
 *
 * Honest samples: per-WPM-tier realistic typing traces with Gaussian jitter
 * (N=30 ms stddev around the target inter-keystroke interval).
 *
 * Cheat samples: specific attack traces — paste, uniform bot, macro-paced,
 * jump, oversized WPM.
 *
 * Single-typist synthesized corpus — spec § 2.1.3 permits this with
 * explicit disclosure in the writeup. Multi-typist corpus collection
 * (real friends or the Aalto 136M dataset) is Phase 4.2.
 *
 * Run: npx tsx server/test/fixtures/cheat-corpus/build-corpus.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PASSAGE_CHARS = 180; // roughly a "medium" race
const CHARS_PER_WORD = 5;

interface ServerGhostPoint {
  charIndex: number;
  serverMs: number;
}

interface Sample {
  label: string;
  serverGhost: ServerGhostPoint[];
  updateBuckets: number[];
  wpm: number;
}

function gaussian(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return mean + stddev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Typing-WPM → expected inter-keystroke interval
function intervalForWpm(wpm: number): number {
  // WPM × 5 chars/word = chars/min; /60 = chars/sec; 1000/cs = ms/char
  return 60_000 / (wpm * CHARS_PER_WORD);
}

/** Honest typist at given WPM with realistic jitter + occasional micro-pause. */
function honestSample(label: string, targetWpm: number): Sample {
  const mean = intervalForWpm(targetWpm);
  const stddev = Math.max(20, mean * 0.35); // ≥ 20 ms jitter, scales up at lower WPM
  const ghost: ServerGhostPoint[] = [];
  let t = 0;
  for (let i = 0; i < PASSAGE_CHARS; i++) {
    // Small chance of a micro-pause (e.g., reading ahead)
    if (Math.random() < 0.05) t += 100 + Math.random() * 400;
    t += Math.max(15, gaussian(mean, stddev));
    ghost.push({ charIndex: i + 1, serverMs: Math.round(t) });
  }
  const wpm = Math.round((PASSAGE_CHARS / CHARS_PER_WORD) / (t / 60_000));
  // Realistic progress-update buckets: ~8 Hz, so ~5-8 chars per update at 60 WPM
  const updateBuckets = bucketByHz(ghost, 8);
  return { label, serverGhost: ghost, updateBuckets, wpm };
}

/** Cheat: paste of 30 chars in a single progress_update within the first 2 updates. */
function cheatPasteSample(label: string): Sample {
  const ghost: ServerGhostPoint[] = [];
  // 30-char paste at t=150 ms (single update), then normal typing for the rest
  for (let i = 0; i < 30; i++) {
    ghost.push({ charIndex: i + 1, serverMs: 150 + i * 3 }); // crammed into one update
  }
  let t = 300;
  for (let i = 30; i < PASSAGE_CHARS; i++) {
    t += gaussian(100, 25);
    ghost.push({ charIndex: i + 1, serverMs: Math.round(t) });
  }
  // First update contains 30 chars
  const updateBuckets = [30, 5, 5, 5, 5, 5, 5, 5, 5, 5];
  const wpm = Math.round((PASSAGE_CHARS / CHARS_PER_WORD) / (t / 60_000));
  return { label, serverGhost: ghost, updateBuckets, wpm };
}

/** Cheat: perfectly uniform 100ms intervals for the whole race. */
function cheatUniformBot(label: string): Sample {
  const ghost: ServerGhostPoint[] = [];
  for (let i = 0; i < PASSAGE_CHARS; i++) {
    ghost.push({ charIndex: i + 1, serverMs: (i + 1) * 100 });
  }
  const updateBuckets = bucketByHz(ghost, 8);
  const wpm = Math.round((PASSAGE_CHARS / CHARS_PER_WORD) / (PASSAGE_CHARS * 100 / 60_000));
  return { label, serverGhost: ghost, updateBuckets, wpm };
}

/** Cheat: macro-paced typing — 90ms intervals with stddev ~3ms. */
function cheatMacroPaced(label: string): Sample {
  const ghost: ServerGhostPoint[] = [];
  let t = 0;
  for (let i = 0; i < PASSAGE_CHARS; i++) {
    t += 90 + gaussian(0, 3);
    ghost.push({ charIndex: i + 1, serverMs: Math.round(t) });
  }
  const updateBuckets = bucketByHz(ghost, 8);
  const wpm = Math.round((PASSAGE_CHARS / CHARS_PER_WORD) / (t / 60_000));
  return { label, serverGhost: ghost, updateBuckets, wpm };
}

/** Cheat: mid-race 10-char jump after 2 s. */
function cheatJumpSample(label: string): Sample {
  const ghost: ServerGhostPoint[] = [];
  let t = 0;
  for (let i = 0; i < 20; i++) {
    t += gaussian(150, 40);
    ghost.push({ charIndex: i + 1, serverMs: Math.round(t) });
  }
  // Sudden jump of 10 chars in a single sample
  t += 80;
  const afterJumpIndex = 30;
  ghost.push({ charIndex: afterJumpIndex, serverMs: Math.round(t) });
  for (let i = afterJumpIndex; i < PASSAGE_CHARS; i++) {
    t += gaussian(150, 40);
    ghost.push({ charIndex: i + 1, serverMs: Math.round(t) });
  }
  const updateBuckets = bucketByHz(ghost, 8);
  const wpm = Math.round((PASSAGE_CHARS / CHARS_PER_WORD) / (t / 60_000));
  return { label, serverGhost: ghost, updateBuckets, wpm };
}

/** Cheat: sustained ~250 WPM. */
function cheatWpmCeiling(label: string): Sample {
  const mean = intervalForWpm(250);
  const ghost: ServerGhostPoint[] = [];
  let t = 0;
  for (let i = 0; i < PASSAGE_CHARS; i++) {
    t += Math.max(10, gaussian(mean, mean * 0.3));
    ghost.push({ charIndex: i + 1, serverMs: Math.round(t) });
  }
  const updateBuckets = bucketByHz(ghost, 8);
  const wpm = Math.round((PASSAGE_CHARS / CHARS_PER_WORD) / (t / 60_000));
  return { label, serverGhost: ghost, updateBuckets, wpm };
}

/** Bucket keystrokes into progress_update batches at the given broadcast Hz. */
function bucketByHz(ghost: ServerGhostPoint[], hz: number): number[] {
  const windowMs = 1000 / hz;
  const buckets: number[] = [];
  let current = 0;
  let windowEnd = windowMs;
  for (const p of ghost) {
    while (p.serverMs > windowEnd) {
      buckets.push(current);
      current = 0;
      windowEnd += windowMs;
    }
    current++;
  }
  if (current > 0) buckets.push(current);
  return buckets;
}

function main() {
  // Deterministic seed for reproducibility — simple implementation
  // (Math.random() isn't seedable, but single runs per CI pin enough)
  const honest: Sample[] = [];
  // 2 samples per WPM tier
  for (const wpm of [40, 60, 80, 100, 120, 140]) {
    honest.push(honestSample(`honest-${wpm}wpm-a`, wpm));
    honest.push(honestSample(`honest-${wpm}wpm-b`, wpm));
  }

  const cheat: Sample[] = [
    cheatPasteSample("cheat-paste-1"),
    cheatPasteSample("cheat-paste-2"),
    cheatUniformBot("cheat-uniform-1"),
    cheatUniformBot("cheat-uniform-2"),
    cheatMacroPaced("cheat-macro-1"),
    cheatMacroPaced("cheat-macro-2"),
    cheatJumpSample("cheat-jump-1"),
    cheatJumpSample("cheat-jump-2"),
    cheatWpmCeiling("cheat-wpm-1"),
    cheatWpmCeiling("cheat-wpm-2"),
  ];

  mkdirSync(__dirname, { recursive: true });
  writeFileSync(join(__dirname, "honest-samples.json"), JSON.stringify(honest, null, 2));
  writeFileSync(join(__dirname, "cheat-samples.json"), JSON.stringify(cheat, null, 2));

  console.log(`Wrote ${honest.length} honest samples, ${cheat.length} cheat samples.`);
}

main();
