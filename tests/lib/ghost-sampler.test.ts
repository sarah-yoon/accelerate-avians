import { describe, it, expect } from "vitest";
import { sampleGhostData } from "@/lib/ghost-sampler";
import type { GhostDataPoint } from "@/types";

describe("sampleGhostData", () => {
  it("returns data unchanged if 500 entries or fewer", () => {
    const data: GhostDataPoint[] = Array.from({ length: 100 }, (_, i) => ({
      charIndex: i,
      ms: i * 100,
    }));
    const result = sampleGhostData(data);
    expect(result).toEqual(data);
    expect(result.length).toBe(100);
  });

  it("samples down to at most 500 entries for large data", () => {
    const data: GhostDataPoint[] = Array.from({ length: 1500 }, (_, i) => ({
      charIndex: i,
      ms: i * 10,
    }));
    const result = sampleGhostData(data);
    expect(result.length).toBeLessThanOrEqual(500);
    expect(result.length).toBeGreaterThan(0);
  });

  it("always includes the final entry", () => {
    const data: GhostDataPoint[] = Array.from({ length: 1500 }, (_, i) => ({
      charIndex: i,
      ms: i * 10,
    }));
    const result = sampleGhostData(data);
    const last = result[result.length - 1];
    expect(last).toEqual(data[data.length - 1]);
  });

  it("always includes the first entry", () => {
    const data: GhostDataPoint[] = Array.from({ length: 1500 }, (_, i) => ({
      charIndex: i,
      ms: i * 10,
    }));
    const result = sampleGhostData(data);
    expect(result[0]).toEqual(data[0]);
  });
});
