import { describe, it, expect } from "vitest";
import { computeWpm } from "@/hooks/useCurrentWPM";

describe("computeWpm", () => {
  it("returns 0 for empty samples", () => {
    expect(computeWpm([], 0)).toBe(0);
  });

  it("returns 0 when all samples are outside the window", () => {
    const samples = [{ ms: 100 }, { ms: 200 }];
    // 3s window ending at t=10000 → cutoff 7000, samples all below cutoff
    expect(computeWpm(samples, 10_000)).toBe(0);
  });

  it("computes rolling WPM from keystrokes in the 3s window", () => {
    // 30 keystrokes spaced 100ms, all inside [now-3000, now]
    const samples = Array.from({ length: 30 }, (_, i) => ({ ms: 7000 + i * 100 }));
    const now = 10_000;
    // 30 chars = 6 words; window = 3000 ms; 6/3000*60000 = 120 WPM
    expect(computeWpm(samples, now)).toBe(120);
  });

  it("respects a custom window size", () => {
    const samples = Array.from({ length: 50 }, (_, i) => ({ ms: i * 100 }));
    const now = 5000;
    // 5s window, 50 keystrokes over 5s → 10 words / 5s × 60 = 120 WPM
    expect(computeWpm(samples, now, 5000)).toBe(120);
  });

  it("ignores samples in the future relative to now", () => {
    const samples = [{ ms: 8000 }, { ms: 12_000 }];
    const now = 10_000;
    // only ms=8000 qualifies (within 7000..10000); 1 char = 0.2 words / 3s × 60 = 4 WPM
    expect(computeWpm(samples, now)).toBe(4);
  });
});
