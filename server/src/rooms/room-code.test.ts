import { describe, it, expect } from "vitest";
import { generateRoomCode } from "./room-code.js";

const BIRD_NAMES = [
  "ROBIN", "FINCH", "CRANE", "EAGLE", "SWIFT",
  "HERON", "QUAIL", "RAVEN", "WREN", "STORK",
  "DUCKY", "OWLET", "GREBE", "IBIS", "SHRIKE",
  "VIREO", "PIPIT", "MACAW", "GROUSE", "EGRET",
];

describe("generateRoomCode", () => {
  it("generates a code in BIRD-NN format", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z]+-\d{2}$/);
    const [bird, num] = code.split("-");
    expect(BIRD_NAMES).toContain(bird);
    expect(Number(num)).toBeGreaterThanOrEqual(10);
    expect(Number(num)).toBeLessThanOrEqual(99);
  });

  it("generates unique codes across multiple calls", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(generateRoomCode());
    }
    // With 20 birds * 90 numbers = 1800 possibilities, 50 codes should mostly be unique
    expect(codes.size).toBeGreaterThanOrEqual(40);
  });
});
