/**
 * Preview script: generates a sparrow sprite and saves a large preview PNG.
 * Run: npx tsx scripts/preview-sparrow.ts
 */
import { createCanvas } from "canvas";
import { writeFileSync } from "fs";
import { join } from "path";

const SCALE = 4; // each pixel = 4px on screen
const FRAME = 16;
const FRAME_SCALED = FRAME * SCALE;

// Warm sparrow palette
const BROWN = "#8B6B4A";       // main body
const DARK_BROWN = "#5C4430";  // wing, tail
const TAN = "#C4A67A";         // belly, breast highlight
const LIGHT_TAN = "#D4BC98";   // belly center
const BEAK = "#D48030";        // orange beak
const EYE = "#1A1A1A";         // black dot eye
const FEET = "#7A5A3A";        // leg color

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, scale: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x * scale, y * scale, scale, scale);
}

function drawSparrow(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  wingState: number, // 0=up, 1=mid, 2=down
  scale: number,
) {
  // Head — round, 4x4 with rounded corners
  //   .HH.
  //   HHHH
  //   HHHH
  //   .HH.
  px(ctx, ox + 7, oy + 2, BROWN, scale);
  px(ctx, ox + 8, oy + 2, BROWN, scale);
  px(ctx, ox + 6, oy + 3, BROWN, scale);
  px(ctx, ox + 7, oy + 3, BROWN, scale);
  px(ctx, ox + 8, oy + 3, BROWN, scale);
  px(ctx, ox + 9, oy + 3, BROWN, scale);
  px(ctx, ox + 6, oy + 4, BROWN, scale);
  px(ctx, ox + 7, oy + 4, BROWN, scale);
  px(ctx, ox + 8, oy + 4, BROWN, scale);
  px(ctx, ox + 9, oy + 4, BROWN, scale);
  px(ctx, ox + 7, oy + 5, BROWN, scale);
  px(ctx, ox + 8, oy + 5, BROWN, scale);

  // Eye — single black dot
  px(ctx, ox + 8, oy + 3, EYE, scale);

  // Beak — small, 2px, pointing right
  px(ctx, ox + 10, oy + 4, BEAK, scale);
  px(ctx, ox + 11, oy + 4, BEAK, scale);

  // Body — round oval, 7x5
  //     .BBBBB.
  //    BBBBBBB
  //    BBBBBBB
  //    BBBBBBB
  //     .BBBBB.
  //      .BBB.
  px(ctx, ox + 4, oy + 5, BROWN, scale);
  px(ctx, ox + 5, oy + 5, BROWN, scale);
  px(ctx, ox + 6, oy + 5, BROWN, scale);
  px(ctx, ox + 9, oy + 5, BROWN, scale);

  px(ctx, ox + 3, oy + 6, BROWN, scale);
  px(ctx, ox + 4, oy + 6, BROWN, scale);
  px(ctx, ox + 5, oy + 6, BROWN, scale);
  px(ctx, ox + 6, oy + 6, BROWN, scale);
  px(ctx, ox + 7, oy + 6, BROWN, scale);
  px(ctx, ox + 8, oy + 6, BROWN, scale);
  px(ctx, ox + 9, oy + 6, BROWN, scale);

  px(ctx, ox + 3, oy + 7, BROWN, scale);
  px(ctx, ox + 4, oy + 7, BROWN, scale);
  px(ctx, ox + 5, oy + 7, BROWN, scale);
  px(ctx, ox + 6, oy + 7, BROWN, scale);
  px(ctx, ox + 7, oy + 7, BROWN, scale);
  px(ctx, ox + 8, oy + 7, BROWN, scale);
  px(ctx, ox + 9, oy + 7, BROWN, scale);

  px(ctx, ox + 3, oy + 8, BROWN, scale);
  px(ctx, ox + 4, oy + 8, BROWN, scale);
  px(ctx, ox + 5, oy + 8, BROWN, scale);
  px(ctx, ox + 6, oy + 8, BROWN, scale);
  px(ctx, ox + 7, oy + 8, BROWN, scale);
  px(ctx, ox + 8, oy + 8, BROWN, scale);
  px(ctx, ox + 9, oy + 8, BROWN, scale);

  px(ctx, ox + 4, oy + 9, BROWN, scale);
  px(ctx, ox + 5, oy + 9, BROWN, scale);
  px(ctx, ox + 6, oy + 9, BROWN, scale);
  px(ctx, ox + 7, oy + 9, BROWN, scale);
  px(ctx, ox + 8, oy + 9, BROWN, scale);

  px(ctx, ox + 5, oy + 10, BROWN, scale);
  px(ctx, ox + 6, oy + 10, BROWN, scale);
  px(ctx, ox + 7, oy + 10, BROWN, scale);

  // Breast/belly highlight — tan area on front of body
  px(ctx, ox + 8, oy + 6, TAN, scale);
  px(ctx, ox + 9, oy + 6, TAN, scale);
  px(ctx, ox + 8, oy + 7, TAN, scale);
  px(ctx, ox + 9, oy + 7, TAN, scale);
  px(ctx, ox + 7, oy + 8, TAN, scale);
  px(ctx, ox + 8, oy + 8, TAN, scale);
  px(ctx, ox + 9, oy + 8, TAN, scale);

  // Lighter belly center
  px(ctx, ox + 6, oy + 9, LIGHT_TAN, scale);
  px(ctx, ox + 7, oy + 9, LIGHT_TAN, scale);
  px(ctx, ox + 8, oy + 9, LIGHT_TAN, scale);

  // Tail feathers — short, 3px, angled left
  px(ctx, ox + 2, oy + 6, DARK_BROWN, scale);
  px(ctx, ox + 1, oy + 7, DARK_BROWN, scale);
  px(ctx, ox + 2, oy + 7, DARK_BROWN, scale);
  px(ctx, ox + 1, oy + 8, DARK_BROWN, scale);

  // Wing — changes with animation state
  if (wingState === 0) {
    // Wings UP — above body
    px(ctx, ox + 5, oy + 2, DARK_BROWN, scale);
    px(ctx, ox + 6, oy + 2, DARK_BROWN, scale);
    px(ctx, ox + 4, oy + 3, DARK_BROWN, scale);
    px(ctx, ox + 5, oy + 3, DARK_BROWN, scale);
    px(ctx, ox + 6, oy + 3, DARK_BROWN, scale);
    px(ctx, ox + 4, oy + 4, DARK_BROWN, scale);
    px(ctx, ox + 5, oy + 4, DARK_BROWN, scale);
    px(ctx, ox + 5, oy + 5, DARK_BROWN, scale);
  } else if (wingState === 1) {
    // Wings MID — resting on body
    px(ctx, ox + 4, oy + 6, DARK_BROWN, scale);
    px(ctx, ox + 5, oy + 6, DARK_BROWN, scale);
    px(ctx, ox + 6, oy + 6, DARK_BROWN, scale);
    px(ctx, ox + 4, oy + 7, DARK_BROWN, scale);
    px(ctx, ox + 5, oy + 7, DARK_BROWN, scale);
    px(ctx, ox + 6, oy + 7, DARK_BROWN, scale);
    px(ctx, ox + 5, oy + 8, DARK_BROWN, scale);
    px(ctx, ox + 6, oy + 8, DARK_BROWN, scale);
  } else if (wingState === 2) {
    // Wings DOWN — below body
    px(ctx, ox + 4, oy + 8, DARK_BROWN, scale);
    px(ctx, ox + 5, oy + 8, DARK_BROWN, scale);
    px(ctx, ox + 6, oy + 8, DARK_BROWN, scale);
    px(ctx, ox + 4, oy + 9, DARK_BROWN, scale);
    px(ctx, ox + 5, oy + 9, DARK_BROWN, scale);
    px(ctx, ox + 6, oy + 9, DARK_BROWN, scale);
    px(ctx, ox + 5, oy + 10, DARK_BROWN, scale);
    px(ctx, ox + 5, oy + 11, DARK_BROWN, scale);
  }

  // Feet — two tiny legs
  px(ctx, ox + 6, oy + 11, FEET, scale);
  px(ctx, ox + 6, oy + 12, FEET, scale);
  px(ctx, ox + 8, oy + 11, FEET, scale);
  px(ctx, ox + 8, oy + 12, FEET, scale);
}

// === Generate preview (3 frames side by side at 4x scale) ===
const previewCanvas = createCanvas(FRAME_SCALED * 3 + 16, FRAME_SCALED + 32);
const previewCtx = previewCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;

// Dark background for preview
previewCtx.fillStyle = "#161620";
previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

// Labels
previewCtx.fillStyle = "#888";
previewCtx.font = "12px monospace";
previewCtx.fillText("WINGS UP", 12, FRAME_SCALED + 20);
previewCtx.fillText("WINGS MID", FRAME_SCALED + 16, FRAME_SCALED + 20);
previewCtx.fillText("WINGS DOWN", FRAME_SCALED * 2 + 16, FRAME_SCALED + 20);

// Draw 3 frames
drawSparrow(previewCtx, 0, 0, 0, SCALE);   // up
drawSparrow(previewCtx, FRAME, 0, 1, SCALE); // mid (offset by FRAME in design coords, but scale applies)

// Need to use pixel offsets for preview
const preview2 = createCanvas(FRAME_SCALED * 3 + 16, FRAME_SCALED + 32);
const p2ctx = preview2.getContext("2d") as unknown as CanvasRenderingContext2D;
p2ctx.fillStyle = "#161620";
p2ctx.fillRect(0, 0, preview2.width, preview2.height);

p2ctx.fillStyle = "#888";
p2ctx.font = "12px monospace";
p2ctx.fillText("WINGS UP", 12, FRAME_SCALED + 20);
p2ctx.fillText("WINGS MID", FRAME_SCALED + 16, FRAME_SCALED + 20);
p2ctx.fillText("WINGS DOWN", FRAME_SCALED * 2 + 16, FRAME_SCALED + 20);

// Frame borders
for (let i = 0; i < 3; i++) {
  const x = i * (FRAME_SCALED + 4) + 4;
  p2ctx.strokeStyle = "#444";
  p2ctx.strokeRect(x, 4, FRAME_SCALED, FRAME_SCALED);
}

drawSparrow(p2ctx, 4 / SCALE, 4 / SCALE, 0, SCALE);
drawSparrow(p2ctx, (FRAME_SCALED + 8) / SCALE, 4 / SCALE, 1, SCALE);
drawSparrow(p2ctx, (FRAME_SCALED * 2 + 12) / SCALE, 4 / SCALE, 2, SCALE);

writeFileSync(join(__dirname, "..", "ss", "sparrow-preview.png"), preview2.toBuffer("image/png"));
console.log("Saved preview to ss/sparrow-preview.png");

// === Generate actual sprite sheet (64x16, 4 frames: mid, down, up, down) ===
const spriteCanvas = createCanvas(64, 16);
const spriteCtx = spriteCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;

const wingStates = [1, 2, 0, 2]; // mid, down, up, down (rest → flap cycle)
for (let frame = 0; frame < 4; frame++) {
  drawSparrow(spriteCtx, frame * 16, 0, wingStates[frame], 1);
}

writeFileSync(join(__dirname, "..", "public", "sprites", "sparrow.png"), spriteCanvas.toBuffer("image/png"));
console.log("Saved sprite to public/sprites/sparrow.png");
