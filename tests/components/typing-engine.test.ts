import { describe, it, expect, beforeEach } from "vitest";
import { TypingEngine } from "@/components/typing/typing-engine";

describe("TypingEngine", () => {
  let engine: TypingEngine;
  const passage = "hello world";

  beforeEach(() => {
    engine = new TypingEngine(passage);
  });

  it("starts at position 0 with no errors", () => {
    expect(engine.cursorPos).toBe(0);
    expect(engine.errors).toBe(0);
    expect(engine.isComplete).toBe(false);
  });

  it("advances cursor on correct keystroke", () => {
    engine.handleKey("h", 100);
    expect(engine.cursorPos).toBe(1);
    expect(engine.errors).toBe(0);
  });

  it("records error on incorrect keystroke without advancing", () => {
    engine.handleKey("x", 100);
    expect(engine.cursorPos).toBe(0);
    expect(engine.errors).toBe(1);
    expect(engine.hasError).toBe(true);
  });

  it("clears error state on correct keystroke after error", () => {
    engine.handleKey("x", 100);
    expect(engine.hasError).toBe(true);
    engine.handleKey("h", 200);
    expect(engine.hasError).toBe(false);
    expect(engine.cursorPos).toBe(1);
  });

  it("records ghost data points on correct keystrokes", () => {
    engine.handleKey("h", 100);
    engine.handleKey("e", 200);
    expect(engine.clientGhostData).toEqual([
      { charIndex: 0, ms: 100 },
      { charIndex: 1, ms: 200 },
    ]);
  });

  it("does not record ghost data on errors", () => {
    engine.handleKey("x", 100);
    expect(engine.clientGhostData).toEqual([]);
  });

  it("marks complete when all characters typed", () => {
    for (let i = 0; i < passage.length; i++) {
      engine.handleKey(passage[i], (i + 1) * 100);
    }
    expect(engine.isComplete).toBe(true);
  });

  it("computes WPM for display (client-side)", () => {
    // Type "hello" (5 chars, ~1 word) in 1000ms
    for (let i = 0; i < 5; i++) {
      engine.handleKey(passage[i], (i + 1) * 200);
    }
    const wpm = engine.getCurrentWpm(1000);
    // 1 word / 1 second * 60 = 60 WPM (approximately)
    expect(wpm).toBeGreaterThan(0);
  });

  it("tracks total and correct keystrokes", () => {
    engine.handleKey("x", 100); // error
    engine.handleKey("h", 200); // correct
    engine.handleKey("e", 300); // correct
    expect(engine.totalKeystrokes).toBe(3);
    expect(engine.correctKeystrokes).toBe(2);
  });

  it("ignores keys during IME composition", () => {
    engine.setComposing(true);
    engine.handleKey("h", 100);
    expect(engine.cursorPos).toBe(0);
    expect(engine.totalKeystrokes).toBe(0);
  });

  it("resumes after IME composition ends", () => {
    engine.setComposing(true);
    engine.handleKey("h", 100);
    engine.setComposing(false);
    engine.handleKey("h", 200);
    expect(engine.cursorPos).toBe(1);
  });
});
