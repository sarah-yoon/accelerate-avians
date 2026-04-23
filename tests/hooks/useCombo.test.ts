import { describe, it, expect } from "vitest";
import {
  computeCombo,
  tierFor,
  TIER_THRESHOLDS,
  type ComboState,
} from "@/hooks/useCombo";

const initial: ComboState = { count: 0, paused: false, pausedAtCharIndex: 0 };

describe("computeCombo", () => {
  it("first keystroke takes combo from 0 to 1", () => {
    const after = computeCombo(initial, { kind: "correct", charIndex: 1 });
    expect(after).toEqual({ count: 1, paused: false, pausedAtCharIndex: 0 });
  });

  it("resets to 0 on typo", () => {
    let s = initial;
    s = computeCombo(s, { kind: "correct", charIndex: 1 });
    s = computeCombo(s, { kind: "correct", charIndex: 2 });
    s = computeCombo(s, { kind: "incorrect", charIndex: 3 });
    expect(s.count).toBe(0);
    expect(s.paused).toBe(false);
  });

  it("backspace pauses without resetting count", () => {
    let s = initial;
    s = computeCombo(s, { kind: "correct", charIndex: 1 });
    s = computeCombo(s, { kind: "correct", charIndex: 2 });
    s = computeCombo(s, { kind: "correct", charIndex: 3 });
    // Backspace from charIndex=3 → player is now at charIndex=2, paused "just past 3"
    s = computeCombo(s, { kind: "backspace", charIndex: 2 });
    expect(s.count).toBe(3);
    expect(s.paused).toBe(true);
    expect(s.pausedAtCharIndex).toBe(3);
  });

  it("further backspaces while paused keep earliest pausedAtCharIndex", () => {
    let s: ComboState = { count: 3, paused: true, pausedAtCharIndex: 3 };
    s = computeCombo(s, { kind: "backspace", charIndex: 0 });
    expect(s.pausedAtCharIndex).toBe(3); // not clobbered by newer backspace
  });

  it("resume requires typing past pausedAtCharIndex", () => {
    let s: ComboState = { count: 3, paused: true, pausedAtCharIndex: 3 };
    s = computeCombo(s, { kind: "correct", charIndex: 2 });
    expect(s.paused).toBe(true);
    s = computeCombo(s, { kind: "correct", charIndex: 3 });
    expect(s.paused).toBe(true);
    s = computeCombo(s, { kind: "correct", charIndex: 4 });
    expect(s).toEqual({ count: 4, paused: false, pausedAtCharIndex: 0 });
  });

  it("reset zeroes state", () => {
    const s: ComboState = { count: 20, paused: true, pausedAtCharIndex: 10 };
    expect(computeCombo(s, { kind: "reset" })).toEqual(initial);
  });
});

describe("tierFor", () => {
  it("maps counts to correct tier names", () => {
    expect(tierFor(0)).toBe("Fledgling");
    expect(tierFor(4)).toBe("Fledgling");
    expect(tierFor(5)).toBe("Flapping");
    expect(tierFor(14)).toBe("Flapping");
    expect(tierFor(15)).toBe("Soaring");
    expect(tierFor(34)).toBe("Soaring");
    expect(tierFor(35)).toBe("Migrating");
    expect(tierFor(74)).toBe("Migrating");
    expect(tierFor(75)).toBe("Skyborne");
    expect(tierFor(500)).toBe("Skyborne");
  });
});

describe("TIER_THRESHOLDS", () => {
  it("matches spec § 3.5 (5 / 15 / 35 / 75)", () => {
    expect(TIER_THRESHOLDS).toEqual({
      Fledgling: 0,
      Flapping: 5,
      Soaring: 15,
      Migrating: 35,
      Skyborne: 75,
    });
  });
});
