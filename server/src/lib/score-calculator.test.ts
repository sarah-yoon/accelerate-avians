import { describe, it, expect } from "vitest";
import { calculateResults } from "./score-calculator.js";

describe("calculateResults", () => {
  it("calculates WPM from ghostData timestamps and word count", () => {
    // 10 words, ghostData spans 12000ms = 50 WPM
    const ghostData = [
      { charIndex: 0, ms: 0 },
      { charIndex: 50, ms: 12000 },
    ];
    const result = calculateResults(ghostData, 10, 50, 50);
    expect(result.wpm).toBe(50);
  });

  it("calculates accuracy from correct/total keystrokes", () => {
    const ghostData = [
      { charIndex: 0, ms: 0 },
      { charIndex: 50, ms: 10000 },
    ];
    const result = calculateResults(ghostData, 10, 45, 50);
    expect(result.accuracy).toBeCloseTo(0.9);
  });

  it("returns 0 WPM when ghostData is empty", () => {
    const result = calculateResults([], 10, 50, 50);
    expect(result.wpm).toBe(0);
  });

  it("returns 0 WPM when ghostData has only one entry", () => {
    const result = calculateResults([{ charIndex: 0, ms: 0 }], 10, 50, 50);
    expect(result.wpm).toBe(0);
  });

  it("returns 0 accuracy when totalKeystrokes is 0", () => {
    const ghostData = [
      { charIndex: 0, ms: 0 },
      { charIndex: 50, ms: 10000 },
    ];
    const result = calculateResults(ghostData, 10, 0, 0);
    expect(result.accuracy).toBe(0);
  });

  it("rejects ghostData where first ms is not 0", () => {
    const ghostData = [
      { charIndex: 0, ms: 5000 },
      { charIndex: 50, ms: 15000 },
    ];
    const result = calculateResults(ghostData, 10, 50, 50);
    // Should still compute based on elapsed time
    expect(result.wpm).toBe(60); // 10 words / (10000ms / 60000)
  });
});
