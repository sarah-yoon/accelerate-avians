/**
 * Generates pixel art bird sprite PNGs for development.
 * Run: npx tsx scripts/generate-placeholders.ts
 */
import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PUBLIC = join(__dirname, "..", "public");

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

// Helper: draw a single pixel
function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// Helper: draw a filled rectangle of pixels
function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

interface BirdPalette {
  body: string;
  wing: string;
  breast: string;
  beak: string;
  eye: string;
  tail: string;
  belly: string;
}

/**
 * Draw a pixel art bird at (ox, oy) within a 32x32 frame.
 * The bird is ~16x14 pixels, centered in the frame.
 * wingState: 0 = rest (wing mid), 1 = wing down, 2 = wing up
 */
function drawBird(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  palette: BirdPalette,
  wingState: number,
) {
  const { body, wing, breast, beak, eye, tail, belly } = palette;

  // Offset to center ~16x14 bird in 32x32 frame
  const bx = ox + 8;
  const by = oy + 9;

  // === HEAD (top, toward right since bird faces right) ===
  // Head: 5x5 round shape at top-right of bird
  //   Row 0:  .BBB.
  //   Row 1: BBBBB
  //   Row 2: BBBBB
  //   Row 3: BBBBB
  //   Row 4:  BBB.
  px(ctx, bx + 8, by + 0, body);
  px(ctx, bx + 9, by + 0, body);
  px(ctx, bx + 10, by + 0, body);

  rect(ctx, bx + 7, by + 1, 5, 1, body);
  rect(ctx, bx + 7, by + 2, 5, 1, body);
  rect(ctx, bx + 7, by + 3, 5, 1, body);

  px(ctx, bx + 8, by + 4, body);
  px(ctx, bx + 9, by + 4, body);
  px(ctx, bx + 10, by + 4, body);

  // Eye — single pixel, row 2 of head
  px(ctx, bx + 10, by + 2, eye);

  // Beak — triangular, 3 pixels, pointing right from head
  px(ctx, bx + 12, by + 2, beak);
  px(ctx, bx + 12, by + 3, beak);
  px(ctx, bx + 13, by + 3, beak);

  // === BODY (oval, below and to the left of head) ===
  // Body is ~9x6 oval
  //   Row 5:  .BBBBBBB.
  //   Row 6: BBBBBBBBB
  //   Row 7: BBBBBBBBB
  //   Row 8: BBBBBBBBB
  //   Row 9:  BBBBBBBB
  //   Row 10:  .BBBBB.

  // Row 5
  rect(ctx, bx + 3, by + 5, 8, 1, body);

  // Row 6
  rect(ctx, bx + 2, by + 6, 10, 1, body);

  // Row 7
  rect(ctx, bx + 2, by + 7, 10, 1, body);

  // Row 8
  rect(ctx, bx + 2, by + 8, 10, 1, body);

  // Row 9
  rect(ctx, bx + 3, by + 9, 8, 1, body);

  // Row 10
  rect(ctx, bx + 4, by + 10, 6, 1, body);

  // === BREAST / BELLY highlight (front of body) ===
  // Breast color on the front-facing chest area
  px(ctx, bx + 9, by + 5, breast);
  px(ctx, bx + 10, by + 5, breast);
  px(ctx, bx + 10, by + 6, breast);
  px(ctx, bx + 11, by + 6, breast);
  px(ctx, bx + 10, by + 7, breast);
  px(ctx, bx + 11, by + 7, breast);
  px(ctx, bx + 11, by + 8, breast);
  px(ctx, bx + 10, by + 8, breast);

  // Belly (lighter underside)
  rect(ctx, bx + 6, by + 9, 4, 1, belly);
  rect(ctx, bx + 5, by + 10, 4, 1, belly);

  // === TAIL (left side, 3 pixels) ===
  px(ctx, bx + 1, by + 6, tail);
  px(ctx, bx + 0, by + 7, tail);
  px(ctx, bx + 1, by + 7, tail);
  px(ctx, bx + 0, by + 8, tail);

  // === WING ===
  if (wingState === 0) {
    // Rest: wing overlaid on middle of body
    rect(ctx, bx + 4, by + 6, 4, 1, wing);
    rect(ctx, bx + 3, by + 7, 5, 1, wing);
    rect(ctx, bx + 4, by + 8, 4, 1, wing);
    px(ctx, bx + 5, by + 9, wing);
    px(ctx, bx + 6, by + 9, wing);
  } else if (wingState === 1) {
    // Wing down: wing hangs below body
    rect(ctx, bx + 4, by + 7, 4, 1, wing);
    rect(ctx, bx + 3, by + 8, 5, 1, wing);
    rect(ctx, bx + 3, by + 9, 5, 1, wing);
    rect(ctx, bx + 4, by + 10, 4, 1, wing);
    rect(ctx, bx + 5, by + 11, 2, 1, wing);
  } else if (wingState === 2) {
    // Wing up: wing extends above body
    rect(ctx, bx + 5, by + 2, 2, 1, wing);
    rect(ctx, bx + 4, by + 3, 4, 1, wing);
    rect(ctx, bx + 3, by + 4, 4, 1, wing);
    rect(ctx, bx + 4, by + 5, 4, 1, wing);
    rect(ctx, bx + 5, by + 6, 3, 1, wing);
  }

  // === FEET (tiny, 2 pixels each) ===
  px(ctx, bx + 7, by + 11, body);
  px(ctx, bx + 7, by + 12, body);
  px(ctx, bx + 9, by + 11, body);
  px(ctx, bx + 9, by + 12, body);
}

function generateBirdSprite(filename: string, palette: BirdPalette) {
  const canvas = createCanvas(128, 32);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  // Frame order: rest, wing-down, wing-up, wing-down
  const wingStates = [0, 1, 2, 1];

  for (let frame = 0; frame < 4; frame++) {
    drawBird(ctx, frame * 32, 0, palette, wingStates[frame]);
  }

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(join(PUBLIC, "sprites", filename), buffer);
  console.log(`Generated ${filename}`);
}

function generateBackground(filename: string, color1: string, color2: string) {
  const canvas = createCanvas(480, 200);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 480, 200);

  // Pixel clouds
  ctx.fillStyle = "#F0F0F0";
  // Cloud 1
  ctx.fillRect(50, 20, 40, 8);
  ctx.fillRect(55, 14, 30, 6);
  // Cloud 2
  ctx.fillRect(200, 35, 50, 8);
  ctx.fillRect(210, 28, 30, 7);
  // Cloud 3
  ctx.fillRect(380, 15, 35, 8);
  ctx.fillRect(385, 10, 25, 5);

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(join(PUBLIC, "backgrounds", filename), buffer);
  console.log(`Generated ${filename}`);
}

// Main
ensureDir(join(PUBLIC, "sprites"));
ensureDir(join(PUBLIC, "backgrounds"));

// Robin -- brown body, red breast, dark wings, yellow beak
generateBirdSprite("robin.png", {
  body: "#8B4513",
  wing: "#5C3A1E",
  breast: "#E74C3C",
  beak: "#FFD700",
  eye: "#0A0A14",
  tail: "#5C3A1E",
  belly: "#C9956B",
});

// Canary -- bright yellow body, orange wing tips, small orange beak
generateBirdSprite("canary.png", {
  body: "#FFD700",
  wing: "#FFA500",
  breast: "#FFED4A",
  beak: "#FF8C00",
  eye: "#0A0A14",
  tail: "#DAA520",
  belly: "#FFF176",
});

// Bluebird -- blue body, reddish breast accent, white belly, yellow beak
generateBirdSprite("bluebird.png", {
  body: "#3498DB",
  wing: "#1A5276",
  breast: "#E74C3C",
  beak: "#FFD700",
  eye: "#0A0A14",
  tail: "#1A5276",
  belly: "#D6EAF8",
});

// Ghost -- translucent grey bird shape (for ghost replays of real players)
generateBirdSprite("ghost.png", {
  body: "#9E9E9E",
  wing: "#757575",
  breast: "#BDBDBD",
  beak: "#BDBDBD",
  eye: "#424242",
  tail: "#616161",
  belly: "#E0E0E0",
});

/**
 * Draw a ROBOT BIRD at (ox, oy) within a 32x32 frame.
 * Boxy mechanical bird with antenna, gear eye, metal plating, jet wing.
 * wingState: 0 = rest, 1 = wing down, 2 = wing up
 */
function drawRobotBird(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  wingState: number,
) {
  const metal = "#607D8B";      // main body steel
  const darkMetal = "#455A64";  // darker plates
  const lightMetal = "#90A4AE"; // highlights
  const red = "#F44336";        // eye / antenna light
  const orange = "#FF9800";     // jet exhaust
  const yellow = "#FFEB3B";     // antenna tip glow
  const black = "#0A0A14";      // outlines

  const bx = ox + 8;
  const by = oy + 8;

  // === ANTENNA (sticks up from head) ===
  px(ctx, bx + 10, by - 2, darkMetal);
  px(ctx, bx + 10, by - 1, darkMetal);
  px(ctx, bx + 10, by + 0, yellow);  // glowing tip

  // === HEAD (boxy, 5x5) ===
  // Top edge
  rect(ctx, bx + 8, by + 1, 5, 1, darkMetal);
  // Head fill
  rect(ctx, bx + 7, by + 2, 6, 1, metal);
  rect(ctx, bx + 7, by + 3, 6, 1, metal);
  rect(ctx, bx + 7, by + 4, 6, 1, metal);
  // Bottom edge
  rect(ctx, bx + 8, by + 5, 5, 1, darkMetal);
  // Highlight strip on top
  px(ctx, bx + 9, by + 2, lightMetal);
  px(ctx, bx + 10, by + 2, lightMetal);

  // Eye — red LED, 2x2
  px(ctx, bx + 10, by + 3, red);
  px(ctx, bx + 11, by + 3, red);
  px(ctx, bx + 10, by + 4, red);
  px(ctx, bx + 11, by + 4, red);
  // Eye dot
  px(ctx, bx + 11, by + 3, yellow);

  // Beak — angular metal, pointing right
  px(ctx, bx + 13, by + 3, darkMetal);
  px(ctx, bx + 13, by + 4, darkMetal);
  px(ctx, bx + 14, by + 4, lightMetal);

  // === BODY (rectangular/boxy, 10x6) ===
  // Top plate
  rect(ctx, bx + 3, by + 6, 9, 1, darkMetal);
  // Body fill
  rect(ctx, bx + 2, by + 7, 11, 1, metal);
  rect(ctx, bx + 2, by + 8, 11, 1, metal);
  rect(ctx, bx + 2, by + 9, 11, 1, metal);
  rect(ctx, bx + 3, by + 10, 9, 1, metal);
  // Bottom plate
  rect(ctx, bx + 4, by + 11, 7, 1, darkMetal);

  // Body panel lines (rivets/seams)
  px(ctx, bx + 5, by + 7, darkMetal);
  px(ctx, bx + 5, by + 8, darkMetal);
  px(ctx, bx + 5, by + 9, darkMetal);
  px(ctx, bx + 9, by + 7, darkMetal);
  px(ctx, bx + 9, by + 8, darkMetal);
  px(ctx, bx + 9, by + 9, darkMetal);

  // Chest plate highlight
  px(ctx, bx + 10, by + 7, lightMetal);
  px(ctx, bx + 11, by + 7, lightMetal);
  px(ctx, bx + 11, by + 8, lightMetal);
  px(ctx, bx + 12, by + 8, lightMetal);

  // === TAIL / EXHAUST (left side) ===
  px(ctx, bx + 1, by + 7, darkMetal);
  px(ctx, bx + 0, by + 8, darkMetal);
  px(ctx, bx + 1, by + 8, darkMetal);
  px(ctx, bx + 0, by + 9, darkMetal);
  // Exhaust flame (small)
  if (wingState === 2) {
    px(ctx, bx - 1, by + 8, orange);
    px(ctx, bx - 1, by + 9, yellow);
  } else {
    px(ctx, bx - 1, by + 8, orange);
  }

  // === WING (mechanical, angular) ===
  if (wingState === 0) {
    // Rest: wing flat on body
    rect(ctx, bx + 4, by + 7, 4, 1, darkMetal);
    rect(ctx, bx + 3, by + 8, 5, 1, lightMetal);
    rect(ctx, bx + 4, by + 9, 4, 1, darkMetal);
  } else if (wingState === 1) {
    // Wing down: extends below body
    rect(ctx, bx + 4, by + 8, 4, 1, darkMetal);
    rect(ctx, bx + 3, by + 9, 5, 1, lightMetal);
    rect(ctx, bx + 3, by + 10, 5, 1, darkMetal);
    rect(ctx, bx + 4, by + 11, 4, 1, lightMetal);
    rect(ctx, bx + 5, by + 12, 2, 1, darkMetal);
  } else if (wingState === 2) {
    // Wing up: extends above body
    rect(ctx, bx + 5, by + 2, 2, 1, darkMetal);
    rect(ctx, bx + 4, by + 3, 4, 1, lightMetal);
    rect(ctx, bx + 3, by + 4, 5, 1, darkMetal);
    rect(ctx, bx + 4, by + 5, 4, 1, lightMetal);
    rect(ctx, bx + 5, by + 6, 3, 1, darkMetal);
  }

  // === FEET (mechanical, angular) ===
  px(ctx, bx + 7, by + 12, darkMetal);
  px(ctx, bx + 7, by + 13, lightMetal);
  px(ctx, bx + 6, by + 13, darkMetal);
  px(ctx, bx + 10, by + 12, darkMetal);
  px(ctx, bx + 10, by + 13, lightMetal);
  px(ctx, bx + 11, by + 13, darkMetal);
}

function generateRobotSprite(filename: string) {
  const canvas = createCanvas(128, 32);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  const wingStates = [0, 1, 2, 1];
  for (let frame = 0; frame < 4; frame++) {
    drawRobotBird(ctx, frame * 32, 0, wingStates[frame]);
  }

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(join(PUBLIC, "sprites", filename), buffer);
  console.log(`Generated ${filename}`);
}

// Robot bird for bot players
generateRobotSprite("robot.png");

// Backgrounds
generateBackground("bg-far.png", "#87CEEB", "#5B9BD5");
generateBackground("bg-mid.png", "#87CEEB", "#87CEEB");
generateBackground("bg-near.png", "#4CAF50", "#388E3C");

console.log("\nDone! Sprites now look like actual birds.");
