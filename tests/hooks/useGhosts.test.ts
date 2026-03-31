import { describe, it, expect } from "vitest";
import { interpolateGhostProgress } from "@/components/race/race-renderer";
import type { GhostDataPoint } from "@/types";

describe("interpolateGhostProgress", () => {
  const ghostData: GhostDataPoint[] = [
    { charIndex: 0, ms: 0 },
    { charIndex: 25, ms: 5000 },
    { charIndex: 50, ms: 10000 },
    { charIndex: 100, ms: 20000 },
  ];

  it("returns 0 before race starts", () => {
    expect(interpolateGhostProgress(ghostData, -100, 100)).toBe(0);
  });

  it("returns 0 at time 0", () => {
    expect(interpolateGhostProgress(ghostData, 0, 100)).toBe(0);
  });

  it("interpolates between data points", () => {
    // At 2500ms, should be between charIndex 0 and 25 → ~12.5/100 = 0.125
    const progress = interpolateGhostProgress(ghostData, 2500, 100);
    expect(progress).toBeCloseTo(0.125, 1);
  });

  it("returns final progress after race ends", () => {
    const progress = interpolateGhostProgress(ghostData, 30000, 100);
    expect(progress).toBe(1.0);
  });

  it("returns 0 for empty ghost data", () => {
    expect(interpolateGhostProgress([], 5000, 100)).toBe(0);
  });
});
