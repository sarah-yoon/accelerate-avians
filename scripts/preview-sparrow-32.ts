/**
 * Detailed 32x32 sparrow sprite with realistic markings.
 * Run: npx tsx scripts/preview-sparrow-32.ts
 */
import { createCanvas } from "canvas";
import { writeFileSync } from "fs";
import { join } from "path";

const SCALE = 4;
const FRAME = 32;
const FS = FRAME * SCALE; // 128px per frame on screen

// Strict color palette
const GREY_CROWN    = "#8a9a7a";
const CHESTNUT      = "#8b4513";
const DARK_BROWN    = "#3d1f0a";
const MID_BROWN     = "#6b3a1f";
const WARM_BUFF     = "#d4a96a";
const PALE_CREAM    = "#f0e8d0";
const WHITE_WINGBAR = "#f5f0e0";
const BLACK_EYE     = "#0a0a0a";
const PINK_LEGS     = "#c4846a";
const ORANGE_BEAK   = "#d4622a";
const BEAK_TIP      = "#2a1a0a";

// Derived shading tones
const CHESTNUT_LIGHT = "#a05a20";
const CHESTNUT_DARK  = "#5a2a08";
const BUFF_LIGHT     = "#e0bc80";
const GREY_LIGHT     = "#9aaa8a";
const GREY_DARK      = "#6a7a5a";

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, s: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x * s, y * s, s, s);
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, s: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x * s, y * s, w * s, h * s);
}

function drawSparrow32(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  wingState: number, // 0=up, 1=mid-down, 2=down, 3=mid-return
  s: number,
) {
  // Body vertical offset for bob
  const bob = wingState === 0 ? -1 : wingState === 2 ? 1 : 0;
  const by = oy + bob;

  // ========== HEAD (centered around x:20, y:6) ==========

  // Grey crown stripe (center top of head, 2px wide)
  rect(ctx, ox + 19, by + 4, 2, 1, GREY_LIGHT, s);
  rect(ctx, ox + 19, by + 5, 2, 1, GREY_CROWN, s);
  rect(ctx, ox + 19, by + 6, 2, 1, GREY_CROWN, s);
  rect(ctx, ox + 19, by + 7, 2, 1, GREY_DARK, s);

  // Chestnut patches flanking crown
  rect(ctx, ox + 17, by + 5, 2, 1, CHESTNUT_LIGHT, s);
  rect(ctx, ox + 21, by + 5, 2, 1, CHESTNUT_LIGHT, s);
  rect(ctx, ox + 16, by + 6, 3, 1, CHESTNUT, s);
  rect(ctx, ox + 21, by + 6, 3, 1, CHESTNUT, s);
  rect(ctx, ox + 17, by + 7, 2, 1, CHESTNUT, s);
  rect(ctx, ox + 21, by + 7, 2, 1, CHESTNUT, s);

  // Head sides / face (brown)
  rect(ctx, ox + 16, by + 7, 1, 2, MID_BROWN, s);
  rect(ctx, ox + 23, by + 7, 1, 2, MID_BROWN, s);
  rect(ctx, ox + 17, by + 8, 7, 1, MID_BROWN, s);

  // White cheek patches
  rect(ctx, ox + 17, by + 9, 3, 2, PALE_CREAM, s);
  rect(ctx, ox + 17, by + 8, 2, 1, WHITE_WINGBAR, s);

  // Black eye stripe (1px thick, through eye area)
  rect(ctx, ox + 22, by + 8, 3, 1, DARK_BROWN, s);
  px(ctx, ox + 21, by + 8, DARK_BROWN, s);

  // Eye — 2x2 black
  px(ctx, ox + 22, by + 7, BLACK_EYE, s);
  px(ctx, ox + 23, by + 7, BLACK_EYE, s);
  px(ctx, ox + 22, by + 8, BLACK_EYE, s);
  px(ctx, ox + 23, by + 8, BLACK_EYE, s);
  // Eye highlight
  px(ctx, ox + 23, by + 7, DARK_BROWN, s);

  // Beak — 3x2, upper mandible larger
  px(ctx, ox + 24, by + 8, ORANGE_BEAK, s);
  px(ctx, ox + 25, by + 8, ORANGE_BEAK, s);
  px(ctx, ox + 26, by + 8, BEAK_TIP, s);
  px(ctx, ox + 24, by + 9, ORANGE_BEAK, s);
  px(ctx, ox + 25, by + 9, BEAK_TIP, s);

  // ========== BODY ==========
  // Upper back — chestnut with dark streaks
  rect(ctx, ox + 13, by + 10, 10, 1, CHESTNUT, s);
  rect(ctx, ox + 12, by + 11, 12, 1, CHESTNUT, s);
  rect(ctx, ox + 11, by + 12, 13, 1, CHESTNUT, s);
  rect(ctx, ox + 11, by + 13, 13, 1, CHESTNUT, s);
  rect(ctx, ox + 11, by + 14, 13, 1, CHESTNUT, s);
  rect(ctx, ox + 12, by + 15, 12, 1, CHESTNUT, s);
  rect(ctx, ox + 12, by + 16, 12, 1, MID_BROWN, s);
  rect(ctx, ox + 13, by + 17, 10, 1, MID_BROWN, s);
  rect(ctx, ox + 14, by + 18, 8, 1, MID_BROWN, s);
  rect(ctx, ox + 15, by + 19, 6, 1, MID_BROWN, s);

  // Dark brown feather shaft streaks on back
  px(ctx, ox + 14, by + 11, DARK_BROWN, s);
  px(ctx, ox + 14, by + 12, DARK_BROWN, s);
  px(ctx, ox + 17, by + 11, DARK_BROWN, s);
  px(ctx, ox + 17, by + 12, DARK_BROWN, s);
  px(ctx, ox + 17, by + 13, DARK_BROWN, s);
  px(ctx, ox + 20, by + 11, DARK_BROWN, s);
  px(ctx, ox + 20, by + 12, DARK_BROWN, s);
  px(ctx, ox + 14, by + 14, CHESTNUT_DARK, s);
  px(ctx, ox + 20, by + 14, CHESTNUT_DARK, s);

  // Breast and belly — pale cream
  rect(ctx, ox + 20, by + 10, 3, 1, WARM_BUFF, s);
  rect(ctx, ox + 21, by + 11, 3, 1, WARM_BUFF, s);
  rect(ctx, ox + 22, by + 12, 2, 1, PALE_CREAM, s);
  rect(ctx, ox + 22, by + 13, 2, 1, PALE_CREAM, s);
  rect(ctx, ox + 22, by + 14, 2, 1, PALE_CREAM, s);
  rect(ctx, ox + 21, by + 15, 3, 1, PALE_CREAM, s);
  rect(ctx, ox + 20, by + 16, 4, 1, PALE_CREAM, s);
  rect(ctx, ox + 20, by + 17, 3, 1, BUFF_LIGHT, s);
  rect(ctx, ox + 19, by + 18, 3, 1, BUFF_LIGHT, s);

  // Flanks — warm buff
  px(ctx, ox + 23, by + 12, WARM_BUFF, s);
  px(ctx, ox + 23, by + 13, WARM_BUFF, s);
  px(ctx, ox + 23, by + 14, WARM_BUFF, s);
  px(ctx, ox + 11, by + 15, WARM_BUFF, s);
  px(ctx, ox + 11, by + 16, WARM_BUFF, s);

  // Rump — warm brown, slightly paler
  rect(ctx, ox + 12, by + 17, 3, 1, CHESTNUT_LIGHT, s);
  rect(ctx, ox + 13, by + 18, 3, 1, CHESTNUT_LIGHT, s);

  // ========== TAIL ==========
  // Dark brown, notched
  rect(ctx, ox + 9, by + 16, 3, 1, DARK_BROWN, s);
  rect(ctx, ox + 8, by + 17, 4, 1, DARK_BROWN, s);
  rect(ctx, ox + 7, by + 18, 5, 1, DARK_BROWN, s);
  rect(ctx, ox + 6, by + 19, 6, 1, DARK_BROWN, s);
  // Pale edges
  px(ctx, ox + 6, by + 19, MID_BROWN, s);
  px(ctx, ox + 11, by + 19, MID_BROWN, s);
  // Notch — center 2px shorter
  px(ctx, ox + 8, by + 19, MID_BROWN, s);
  px(ctx, ox + 9, by + 19, MID_BROWN, s);

  // Tail fans wider on downstroke
  if (wingState === 2) {
    px(ctx, ox + 5, by + 20, DARK_BROWN, s);
    rect(ctx, ox + 6, by + 20, 6, 1, DARK_BROWN, s);
    px(ctx, ox + 12, by + 19, DARK_BROWN, s);
  }

  // ========== WINGS ==========
  if (wingState === 0) {
    // WINGS FULLY RAISED — above body
    // Wing coverts
    rect(ctx, ox + 14, by + 4, 4, 1, CHESTNUT, s);
    rect(ctx, ox + 13, by + 5, 5, 1, CHESTNUT, s);
    rect(ctx, ox + 12, by + 6, 5, 1, CHESTNUT, s);
    rect(ctx, ox + 12, by + 7, 5, 1, MID_BROWN, s);
    // Dark centers
    px(ctx, ox + 15, by + 5, DARK_BROWN, s);
    px(ctx, ox + 13, by + 6, DARK_BROWN, s);
    px(ctx, ox + 15, by + 6, DARK_BROWN, s);
    // Wing bar
    rect(ctx, ox + 12, by + 8, 5, 1, WHITE_WINGBAR, s);
    // Primaries spread
    rect(ctx, ox + 12, by + 3, 3, 1, DARK_BROWN, s);
    px(ctx, ox + 11, by + 4, DARK_BROWN, s);
    px(ctx, ox + 13, by + 4, DARK_BROWN, s);
    // Pale fringe on primaries
    px(ctx, ox + 11, by + 3, WARM_BUFF, s);
    px(ctx, ox + 15, by + 3, WARM_BUFF, s);

  } else if (wingState === 1) {
    // WINGS MID DOWNSTROKE — extended at body level
    // Full wingspan extends beyond body
    rect(ctx, ox + 8, by + 11, 4, 1, CHESTNUT, s);
    rect(ctx, ox + 8, by + 12, 5, 1, CHESTNUT, s);
    rect(ctx, ox + 8, by + 13, 5, 1, MID_BROWN, s);
    // Dark feather centers
    px(ctx, ox + 9, by + 11, DARK_BROWN, s);
    px(ctx, ox + 11, by + 11, DARK_BROWN, s);
    px(ctx, ox + 9, by + 12, DARK_BROWN, s);
    px(ctx, ox + 11, by + 12, DARK_BROWN, s);
    // Wing bar 1
    rect(ctx, ox + 8, by + 14, 5, 1, WHITE_WINGBAR, s);
    // Dark gap
    rect(ctx, ox + 8, by + 15, 5, 1, DARK_BROWN, s);
    // Wing bar 2
    rect(ctx, ox + 8, by + 16, 4, 1, WHITE_WINGBAR, s);
    // Primaries — splayed
    rect(ctx, ox + 6, by + 13, 2, 1, DARK_BROWN, s);
    rect(ctx, ox + 5, by + 14, 3, 1, DARK_BROWN, s);
    rect(ctx, ox + 5, by + 15, 3, 1, DARK_BROWN, s);
    // Pale edges
    px(ctx, ox + 5, by + 13, WARM_BUFF, s);
    px(ctx, ox + 4, by + 14, WARM_BUFF, s);

  } else if (wingState === 2) {
    // WINGS FULLY LOWERED — below body
    rect(ctx, ox + 12, by + 17, 4, 1, CHESTNUT, s);
    rect(ctx, ox + 11, by + 18, 5, 1, CHESTNUT, s);
    rect(ctx, ox + 11, by + 19, 5, 1, MID_BROWN, s);
    // Dark centers
    px(ctx, ox + 13, by + 18, DARK_BROWN, s);
    px(ctx, ox + 15, by + 18, DARK_BROWN, s);
    // Wing bar
    rect(ctx, ox + 11, by + 20, 5, 1, WHITE_WINGBAR, s);
    // Primaries below
    rect(ctx, ox + 11, by + 21, 4, 1, DARK_BROWN, s);
    rect(ctx, ox + 12, by + 22, 3, 1, DARK_BROWN, s);
    rect(ctx, ox + 13, by + 23, 2, 1, DARK_BROWN, s);
    // Pale edges
    px(ctx, ox + 10, by + 20, WARM_BUFF, s);
    px(ctx, ox + 10, by + 21, WARM_BUFF, s);
    // Curved leading edge
    px(ctx, ox + 10, by + 19, MID_BROWN, s);

  } else if (wingState === 3) {
    // WINGS MID RETURN — similar to 1 but tighter
    rect(ctx, ox + 9, by + 11, 4, 1, CHESTNUT, s);
    rect(ctx, ox + 9, by + 12, 4, 1, CHESTNUT, s);
    rect(ctx, ox + 9, by + 13, 4, 1, MID_BROWN, s);
    // Dark centers
    px(ctx, ox + 10, by + 11, DARK_BROWN, s);
    px(ctx, ox + 10, by + 12, DARK_BROWN, s);
    // Wing bar
    rect(ctx, ox + 9, by + 14, 4, 1, WHITE_WINGBAR, s);
    // Primaries — tighter, less splayed
    rect(ctx, ox + 7, by + 13, 2, 1, DARK_BROWN, s);
    rect(ctx, ox + 7, by + 14, 2, 1, DARK_BROWN, s);
    rect(ctx, ox + 7, by + 15, 2, 1, DARK_BROWN, s);
    // Second wing bar
    rect(ctx, ox + 9, by + 15, 3, 1, DARK_BROWN, s);
    rect(ctx, ox + 9, by + 16, 3, 1, WHITE_WINGBAR, s);
    // Pale edge
    px(ctx, ox + 6, by + 13, WARM_BUFF, s);
  }

  // ========== LEGS & FEET ==========
  // Two thin legs
  px(ctx, ox + 17, by + 20, PINK_LEGS, s);
  px(ctx, ox + 17, by + 21, PINK_LEGS, s);
  px(ctx, ox + 17, by + 22, PINK_LEGS, s);
  px(ctx, ox + 20, by + 20, PINK_LEGS, s);
  px(ctx, ox + 20, by + 21, PINK_LEGS, s);
  px(ctx, ox + 20, by + 22, PINK_LEGS, s);

  // Toes — 3 front, 1 back per foot
  // Left foot
  px(ctx, ox + 16, by + 23, PINK_LEGS, s);
  px(ctx, ox + 17, by + 23, PINK_LEGS, s);
  px(ctx, ox + 18, by + 23, PINK_LEGS, s);
  px(ctx, ox + 16, by + 22, PINK_LEGS, s); // back toe
  // Right foot
  px(ctx, ox + 19, by + 23, PINK_LEGS, s);
  px(ctx, ox + 20, by + 23, PINK_LEGS, s);
  px(ctx, ox + 21, by + 23, PINK_LEGS, s);
  px(ctx, ox + 21, by + 22, PINK_LEGS, s); // back toe

  // Tuck feet up slightly in flight (frames 0, 2)
  if (wingState === 0 || wingState === 2) {
    // Clear lower feet, draw tucked
    // Already drawn — the bob offset handles some of this
  }
}

// === PREVIEW: 4 frames side by side at 4x scale ===
const gap = 8;
const totalW = FS * 4 + gap * 5;
const totalH = FS + 60;
const preview = createCanvas(totalW, totalH);
const pctx = preview.getContext("2d") as unknown as CanvasRenderingContext2D;

pctx.fillStyle = "#161620";
pctx.fillRect(0, 0, totalW, totalH);

const labels = ["F1: UP", "F2: MID", "F3: DOWN", "F4: RETURN"];
for (let i = 0; i < 4; i++) {
  const x = gap + i * (FS + gap);

  // Frame border
  pctx.strokeStyle = "#333";
  pctx.strokeRect(x - 1, gap - 1, FS + 2, FS + 2);

  // Draw bird (translate design coords to frame position)
  drawSparrow32(pctx, x / SCALE, gap / SCALE, i, SCALE);

  // Label
  pctx.fillStyle = "#888";
  pctx.font = "11px monospace";
  pctx.fillText(labels[i], x + 10, FS + gap + 20);
}

writeFileSync(join(__dirname, "..", "ss", "sparrow-32-preview.png"), preview.toBuffer("image/png"));
console.log("Saved preview to ss/sparrow-32-preview.png");

// === SPRITE SHEET: 128x32 (4 frames of 32x32) ===
const sprite = createCanvas(128, 32);
const sctx = sprite.getContext("2d") as unknown as CanvasRenderingContext2D;

for (let i = 0; i < 4; i++) {
  drawSparrow32(sctx, i * 32, 0, [1, 2, 0, 3][i], 1);
}

writeFileSync(join(__dirname, "..", "ss", "sparrow-32-sprite.png"), sprite.toBuffer("image/png"));
console.log("Saved sprite to ss/sparrow-32-sprite.png");
