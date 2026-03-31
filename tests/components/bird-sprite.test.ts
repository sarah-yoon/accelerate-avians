import { describe, it, expect } from "vitest";
import { BirdSprite } from "@/components/race/bird-sprite";

describe("BirdSprite", () => {
  it("starts at frame 0", () => {
    const sprite = new BirdSprite(4, 8);
    expect(sprite.currentFrame).toBe(0);
  });

  it("advances frame after enough time accumulates at 8 FPS", () => {
    const sprite = new BirdSprite(4, 8);
    // 8 FPS = 125ms per frame
    sprite.update(130);
    expect(sprite.currentFrame).toBe(1);
  });

  it("wraps around after last frame", () => {
    const sprite = new BirdSprite(4, 8);
    // Advance through all 4 frames
    sprite.update(130); // frame 1
    sprite.update(130); // frame 2
    sprite.update(130); // frame 3
    sprite.update(130); // frame 0 (wrap)
    expect(sprite.currentFrame).toBe(0);
  });

  it("does not advance frame if not enough time", () => {
    const sprite = new BirdSprite(4, 8);
    sprite.update(50);
    expect(sprite.currentFrame).toBe(0);
  });

  it("returns correct source x for current frame (32px width)", () => {
    const sprite = new BirdSprite(4, 8);
    expect(sprite.getSourceX(32)).toBe(0);
    sprite.update(130);
    expect(sprite.getSourceX(32)).toBe(32);
    sprite.update(130);
    expect(sprite.getSourceX(32)).toBe(64);
  });
});
