import type { GhostDataPoint } from "@/types";

const MAX_ENTRIES = 500;

export function sampleGhostData(data: GhostDataPoint[]): GhostDataPoint[] {
  if (data.length <= MAX_ENTRIES) {
    return data;
  }

  const n = Math.ceil(data.length / MAX_ENTRIES);
  const sampled: GhostDataPoint[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i % n === 0) {
      sampled.push(data[i]);
    }
  }

  // Always include the final entry (replace last slot to stay within MAX_ENTRIES)
  const lastEntry = data[data.length - 1];
  if (sampled[sampled.length - 1] !== lastEntry) {
    if (sampled.length >= MAX_ENTRIES) {
      sampled[sampled.length - 1] = lastEntry;
    } else {
      sampled.push(lastEntry);
    }
  }

  return sampled;
}
