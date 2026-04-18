import { describe, it, expect } from "vitest";
import { mintResumeToken, verifyResumeToken, RESUME_WINDOW_MS } from "./resume-token.js";

const SECRET = "a".repeat(64);

describe("resume-token", () => {
  it("round-trips a valid token", () => {
    const payload = { userId: "u1", roomCode: "ROOM1", sessionEpoch: 1, sessionId: "n1" };
    const token = mintResumeToken(SECRET, payload);
    const result = verifyResumeToken(SECRET, token);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.payload).toMatchObject(payload);
  });

  it("rejects a tampered token", () => {
    const token = mintResumeToken(SECRET, { userId: "u1", roomCode: "R", sessionEpoch: 1, sessionId: "n" });
    const tampered = token.slice(0, -2) + "xx";
    const result = verifyResumeToken(SECRET, tampered);
    expect(result.valid).toBe(false);
  });

  it("rejects a token issued past RESUME_WINDOW_MS + grace", () => {
    const payload = { userId: "u1", roomCode: "R", sessionEpoch: 1, sessionId: "n" };
    const oldIssuedAt = Date.now() - RESUME_WINDOW_MS - 60_000;
    const token = mintResumeToken(SECRET, payload, oldIssuedAt);
    const result = verifyResumeToken(SECRET, token);
    expect(result.valid).toBe(false);
  });

  it("rejects tokens signed with a different secret", () => {
    const token = mintResumeToken(SECRET, { userId: "u1", roomCode: "R", sessionEpoch: 1, sessionId: "n" });
    const result = verifyResumeToken("b".repeat(64), token);
    expect(result.valid).toBe(false);
  });
});
