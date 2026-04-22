#!/usr/bin/env tsx
/**
 * Stream-parse k6 JSON output; report per-stage p50/p95/p99 latency.
 * Stages are time windows relative to the first sample (5s skip into each
 * 30s stage to avoid connection ramp-up).
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { argv } from "node:process";

const STAGES = [
  { name: "rooms_50",  windowStart: 5_000,   windowEnd: 35_000 },
  { name: "rooms_100", windowStart: 55_000,  windowEnd: 85_000 },
  { name: "rooms_200", windowStart: 105_000, windowEnd: 135_000 },
  { name: "rooms_400", windowStart: 155_000, windowEnd: 185_000 },
];

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  const path = argv[2];
  if (!path) {
    console.error("usage: analyze-broadcast-fanout.ts <results.json>");
    process.exit(2);
  }

  const stream = createReadStream(path, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  const stageValues: number[][] = STAGES.map(() => []);
  let runStart: number | null = null;
  let totalSamples = 0;

  for await (const line of rl) {
    if (!line.includes("broadcast_latency_ms")) continue;
    let row: { type?: string; metric?: string; data?: { time?: string; value?: number } };
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.type !== "Point" || row.metric !== "broadcast_latency_ms") continue;
    const tStr = row.data?.time;
    const v = row.data?.value;
    if (!tStr || typeof v !== "number") continue;
    const tMs = new Date(tStr).getTime();
    if (runStart === null) runStart = tMs;
    const elapsed = tMs - runStart;
    totalSamples += 1;
    for (let i = 0; i < STAGES.length; i++) {
      const s = STAGES[i];
      if (elapsed >= s.windowStart && elapsed < s.windowEnd) {
        stageValues[i].push(v);
        break;
      }
    }
  }

  console.log(`Parsed ${totalSamples} broadcast_latency_ms samples\n`);
  console.log("| Stage      | Samples | p50 (ms) | p95 (ms) | p99 (ms) | max (ms) |");
  console.log("|------------|---------|----------|----------|----------|----------|");
  for (let i = 0; i < STAGES.length; i++) {
    const s = STAGES[i];
    const vals = stageValues[i];
    if (vals.length === 0) {
      console.log(`| ${s.name.padEnd(10)} | ${String(0).padEnd(7)} | —        | —        | —        | —        |`);
      continue;
    }
    vals.sort((a, b) => a - b);
    const p50 = percentile(vals, 50);
    const p95 = percentile(vals, 95);
    const p99 = percentile(vals, 99);
    const max = vals[vals.length - 1];
    console.log(
      `| ${s.name.padEnd(10)} | ${String(vals.length).padEnd(7)} | ${p50.toFixed(1).padStart(8)} | ${p95.toFixed(1).padStart(8)} | ${p99.toFixed(1).padStart(8)} | ${max.toFixed(1).padStart(8)} |`
    );
  }
}

main();
