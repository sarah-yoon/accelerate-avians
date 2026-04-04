/**
 * 24x24 minimal sparrow sprite.
 * Clean silhouette, few colors, no fussy detail.
 * Run: npx tsx scripts/preview-sparrow-24.ts
 */
import { createCanvas } from "canvas";
import { writeFileSync } from "fs";
import { join } from "path";

const BODY       = "#8B6B4A";
const BODY_DARK  = "#5C4430";
const WING       = "#4A3020";
const BELLY      = "#D4BC98";
const BEAK       = "#D08030";
const EYE        = "#101010";
const TAIL       = "#3A2418";
const FEET       = "#907060";

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, s: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x * s, y * s, s, s);
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, s: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x * s, y * s, w * s, h * s);
}

function drawSparrow(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  wingState: number,
  s: number,
) {
  const bob = wingState === 0 ? -1 : wingState === 2 ? 1 : 0;
  const by = oy + bob;

  // === HEAD — 5x5 round ===
  rect(ctx, ox + 13, by + 3, 3, 1, BODY, s);
  rect(ctx, ox + 12, by + 4, 5, 1, BODY, s);
  rect(ctx, ox + 12, by + 5, 5, 1, BODY, s);
  rect(ctx, ox + 12, by + 6, 5, 1, BODY, s);
  rect(ctx, ox + 13, by + 7, 3, 1, BODY, s);

  // Eye
  px(ctx, ox + 15, by + 5, EYE, s);

  // Beak
  px(ctx, ox + 17, by + 6, BEAK, s);
  px(ctx, ox + 18, by + 6, BEAK, s);

  // === BODY — 8x6 oval ===
  rect(ctx, ox + 9, by + 7, 7, 1, BODY, s);
  rect(ctx, ox + 8, by + 8, 9, 1, BODY, s);
  rect(ctx, ox + 7, by + 9, 10, 1, BODY, s);
  rect(ctx, ox + 7, by + 10, 10, 1, BODY, s);
  rect(ctx, ox + 7, by + 11, 10, 1, BODY, s);
  rect(ctx, ox + 8, by + 12, 9, 1, BODY, s);
  rect(ctx, ox + 9, by + 13, 7, 1, BODY, s);
  rect(ctx, ox + 10, by + 14, 4, 1, BODY, s);

  // Belly
  rect(ctx, ox + 14, by + 9, 3, 1, BELLY, s);
  rect(ctx, ox + 14, by + 10, 3, 1, BELLY, s);
  rect(ctx, ox + 14, by + 11, 3, 1, BELLY, s);
  rect(ctx, ox + 13, by + 12, 4, 1, BELLY, s);
  rect(ctx, ox + 12, by + 13, 4, 1, BELLY, s);

  // === TAIL ===
  rect(ctx, ox + 5, by + 10, 2, 1, TAIL, s);
  rect(ctx, ox + 4, by + 11, 3, 1, TAIL, s);
  rect(ctx, ox + 3, by + 12, 4, 1, TAIL, s);
  if (wingState === 2) {
    px(ctx, ox + 2, by + 13, TAIL, s);
    px(ctx, ox + 3, by + 13, TAIL, s);
  }

  // === WING ===
  if (wingState === 0) {
    // Up
    rect(ctx, ox + 10, by + 4, 3, 1, WING, s);
    rect(ctx, ox + 9, by + 5, 3, 1, WING, s);
    rect(ctx, ox + 9, by + 6, 3, 1, WING, s);
    rect(ctx, ox + 10, by + 7, 2, 1, WING, s);
  } else if (wingState === 1) {
    // Mid
    rect(ctx, ox + 8, by + 9, 4, 1, WING, s);
    rect(ctx, ox + 8, by + 10, 5, 1, WING, s);
    rect(ctx, ox + 8, by + 11, 4, 1, WING, s);
    rect(ctx, ox + 8, by + 12, 3, 1, BODY_DARK, s);
  } else if (wingState === 2) {
    // Down
    rect(ctx, ox + 9, by + 13, 4, 1, WING, s);
    rect(ctx, ox + 9, by + 14, 4, 1, WING, s);
    rect(ctx, ox + 10, by + 15, 3, 1, WING, s);
    rect(ctx, ox + 10, by + 16, 2, 1, BODY_DARK, s);
  } else if (wingState === 3) {
    // Return
    rect(ctx, ox + 9, by + 9, 3, 1, WING, s);
    rect(ctx, ox + 8, by + 10, 4, 1, WING, s);
    rect(ctx, ox + 8, by + 11, 4, 1, WING, s);
    rect(ctx, ox + 9, by + 12, 2, 1, BODY_DARK, s);
  }

  // === FEET ===
  px(ctx, ox + 12, by + 15, FEET, s);
  px(ctx, ox + 12, by + 16, FEET, s);
  px(ctx, ox + 15, by + 15, FEET, s);
  px(ctx, ox + 15, by + 16, FEET, s);
}

// Sprite sheet: 96x24
const sprite = createCanvas(96, 24);
const sctx = sprite.getContext("2d") as unknown as CanvasRenderingContext2D;
for (let i = 0; i < 4; i++) {
  drawSparrow(sctx, i * 24, 0, [1, 2, 0, 3][i], 1);
}
writeFileSync(join(__dirname, "..", "public", "sprites", "sparrow-24.png"), sprite.toBuffer("image/png"));
writeFileSync(join(__dirname, "..", "ss", "sparrow-24-sprite.png"), sprite.toBuffer("image/png"));
console.log("Saved 24x24 minimal sparrow");
