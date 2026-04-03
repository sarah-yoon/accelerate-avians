import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ProgressValidator } from "./progress-validator.js";

describe("ProgressValidator", () => {
  let validator: ProgressValidator;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    validator = new ProgressValidator(100); // 100 char passage
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("validateProgress", () => {
    it("accepts monotonically increasing charIndex", () => {
      expect(validator.validate("user1", 5).valid).toBe(true);
      expect(validator.validate("user1", 10).valid).toBe(true);
      expect(validator.validate("user1", 50).valid).toBe(true);
    });

    it("rejects non-monotonic charIndex (going backwards)", () => {
      validator.validate("user1", 10);
      const result = validator.validate("user1", 5);
      expect(result.valid).toBe(false);
      expect(!result.valid && result.reason).toBe("charIndex must increase monotonically");
    });

    it("rejects same charIndex (no progress)", () => {
      validator.validate("user1", 10);
      const result = validator.validate("user1", 10);
      expect(result.valid).toBe(false);
      expect(!result.valid && result.reason).toBe("charIndex must increase monotonically");
    });

    it("rejects charIndex exceeding passage length", () => {
      const result = validator.validate("user1", 101);
      expect(result.valid).toBe(false);
      expect(!result.valid && result.reason).toBe("charIndex exceeds passage length");
    });

    it("rejects negative charIndex", () => {
      const result = validator.validate("user1", -1);
      expect(result.valid).toBe(false);
      expect(!result.valid && result.reason).toBe("charIndex exceeds passage length");
    });

    it("tracks separate state per userId", () => {
      validator.validate("user1", 50);
      expect(validator.validate("user2", 10).valid).toBe(true);
      expect(validator.validate("user1", 30).valid).toBe(false);
    });
  });

  describe("rate limiting", () => {
    it("allows up to 30 updates per second", () => {
      for (let i = 1; i <= 30; i++) {
        expect(validator.validate("user1", i).valid).toBe(true);
      }
    });

    it("rejects the 31st update within the same second", () => {
      for (let i = 1; i <= 30; i++) {
        validator.validate("user1", i);
      }
      const result = validator.validate("user1", 31);
      expect(result.valid).toBe(false);
      expect(!result.valid && result.reason).toBe("Rate limit exceeded");
    });

    it("resets rate limit after 1 second window", () => {
      for (let i = 1; i <= 30; i++) {
        validator.validate("user1", i);
      }
      vi.advanceTimersByTime(1001);
      const result = validator.validate("user1", 31);
      expect(result.valid).toBe(true);
    });
  });

  describe("getProgress", () => {
    it("returns 0 for unknown user", () => {
      expect(validator.getCharIndex("user1")).toBe(0);
    });

    it("returns last valid charIndex", () => {
      validator.validate("user1", 42);
      expect(validator.getCharIndex("user1")).toBe(42);
    });
  });
});
