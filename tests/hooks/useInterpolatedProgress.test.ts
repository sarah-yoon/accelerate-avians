import { describe, it, expect } from "vitest";
import { computeInterpolatedCharIndex } from "@/hooks/useInterpolatedProgress";

describe("computeInterpolatedCharIndex", () => {
  it("returns 0 on empty samples", () => {
    expect(computeInterpolatedCharIndex([], 1000)).toBe(0);
  });

  it("returns the single sample's charIndex when only one is present", () => {
    expect(computeInterpolatedCharIndex([{ serverTime: 1000, charIndex: 10 }], 1500)).toBe(10);
  });

  it("lerps between bracketing samples", () => {
    const samples = [
      { serverTime: 1000, charIndex: 10 },
      { serverTime: 1100, charIndex: 20 },
    ];
    // render at t=1050 (midway): expect 15
    expect(computeInterpolatedCharIndex(samples, 1050)).toBe(15);
  });

  it("extrapolates up to 150ms past the last sample", () => {
    const samples = [
      { serverTime: 900, charIndex: 10 },
      { serverTime: 1000, charIndex: 20 },
    ];
    // render at t=1100 (100ms past last): velocity = 10/100 = 0.1/ms, charIndex = 20 + 100*0.1 = 30
    expect(computeInterpolatedCharIndex(samples, 1100)).toBe(30);
  });

  it("freezes at last charIndex past the 150ms extrapolation window", () => {
    const samples = [
      { serverTime: 900, charIndex: 10 },
      { serverTime: 1000, charIndex: 20 },
    ];
    // 1151ms is 151ms past last — beyond the 150ms extrap window → freeze at 20
    expect(computeInterpolatedCharIndex(samples, 1151)).toBe(20);
  });

  it("returns the earliest sample's charIndex if renderTime is before the first sample", () => {
    const samples = [
      { serverTime: 1000, charIndex: 10 },
      { serverTime: 1100, charIndex: 20 },
    ];
    expect(computeInterpolatedCharIndex(samples, 500)).toBe(10);
  });
});
