import { describe, it, expect } from "vitest";
import {
  computeWpm,
  computeAccuracy,
  validateScore,
} from "@/lib/score-validator";

describe("computeWpm", () => {
  it("calculates WPM from word count and time", () => {
    // 30 words in 30000ms = 60 WPM
    expect(computeWpm(30, 30000)).toBe(60);
  });

  it("returns 0 if totalTimeMs is 0", () => {
    expect(computeWpm(10, 0)).toBe(0);
  });
});

describe("computeAccuracy", () => {
  it("calculates accuracy as correct / total", () => {
    expect(computeAccuracy(90, 100)).toBeCloseTo(0.9);
  });

  it("returns 0 if totalKeystrokes is 0", () => {
    expect(computeAccuracy(0, 0)).toBe(0);
  });
});

describe("validateScore", () => {
  const validGhostData = Array.from({ length: 50 }, (_, i) => ({
    charIndex: i,
    ms: i * 200,
  }));

  it("accepts a valid score", () => {
    const result = validateScore({
      ghostData: validGhostData,
      wordCount: 10,
      totalKeystrokes: 55,
      correctKeystrokes: 50,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.wpm).toBeGreaterThan(0);
      expect(result.accuracy).toBeGreaterThan(0);
    }
  });

  it("rejects WPM over 250", () => {
    const fastGhostData = Array.from({ length: 50 }, (_, i) => ({
      charIndex: i,
      ms: i * 2,
    }));
    const result = validateScore({
      ghostData: fastGhostData,
      wordCount: 10,
      totalKeystrokes: 55,
      correctKeystrokes: 50,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("WPM exceeds maximum of 250");
    }
  });

  it("rejects WPM below 25", () => {
    const slowGhostData = Array.from({ length: 50 }, (_, i) => ({
      charIndex: i,
      ms: i * 1200,
    }));
    const result = validateScore({
      ghostData: slowGhostData,
      wordCount: 10,
      totalKeystrokes: 55,
      correctKeystrokes: 50,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("WPM below minimum of 25");
    }
  });

  it("rejects ghostData with fewer than 10 entries", () => {
    const result = validateScore({
      ghostData: [{ charIndex: 0, ms: 0 }],
      wordCount: 10,
      totalKeystrokes: 55,
      correctKeystrokes: 50,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("ghostData must have at least 10 entries");
    }
  });
});
