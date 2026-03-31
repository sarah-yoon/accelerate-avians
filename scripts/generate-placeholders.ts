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

// Pixel art bird template — each row is a string of color codes
// . = transparent, B = body, W = wing, E = eye, K = beak, T = tail, H = highlight
const BIRD_FRAMES = [
  // Frame 0: rest
  [
    "................................",
    "................................",
    "................................",
    "................................",
    "..........BBBBB.................",
    ".........BBBBBBB................",
    "........BBBBBBBBKK..............",
    "........BBBEBBBBBKK.............",
    "........BBBBBBBBBK..............",
    ".......HBBBBBBBB................",
    ".......BBWWWWBBB................",
    "......BBWWWWWBB.................",
    "......BBWWWWWBB.................",
    ".....TTTBBBBBB..................",
    "......TTBBBB....................",
    ".......BBB......................",
    "................................",
    "................................",
  ],
  // Frame 1: wing down
  [
    "................................",
    "................................",
    "................................",
    "................................",
    "..........BBBBB.................",
    ".........BBBBBBB................",
    "........BBBBBBBBKK..............",
    "........BBBEBBBBBKK.............",
    "........BBBBBBBBBK..............",
    ".......HBBBBBBBB................",
    ".......BBBBBBBBB................",
    "......BBBBBBBBB.................",
    "......BBWWWWWBB.................",
    ".....TTTBWWWWB..................",
    "......TTBWWWB...................",
    ".......BBB......................",
    "................................",
    "................................",
  ],
  // Frame 2: wing up
  [
    "................................",
    "................................",
    "......WWWW......................",
    ".......WWWWW....................",
    "..........BBBBB.................",
    ".........BBBBBBB................",
    "........BBBBBBBBKK..............",
    "........BBBEBBBBBKK.............",
    "........BBBBBBBBBK..............",
    ".......HBBBBBBBB................",
    ".......BBBBBBBBB................",
    "......BBBBBBBBB.................",
    "......BBBBBBBBB.................",
    ".....TTTBBBBBB..................",
    "......TTBBBB....................",
    ".......BBB......................",
    "................................",
    "................................",
  ],
  // Frame 3: wing down (same as frame 1)
  [
    "................................",
    "................................",
    "................................",
    "................................",
    "..........BBBBB.................",
    ".........BBBBBBB................",
    "........BBBBBBBBKK..............",
    "........BBBEBBBBBKK.............",
    "........BBBBBBBBBK..............",
    ".......HBBBBBBBB................",
    ".......BBBBBBBBB................",
    "......BBBBBBBBB.................",
    "......BBWWWWWBB.................",
    ".....TTTBWWWWB..................",
    "......TTBWWWB...................",
    ".......BBB......................",
    "................................",
    "................................",
  ],
];

interface BirdColors {
  B: string; // body
  W: string; // wing
  E: string; // eye
  K: string; // beak
  T: string; // tail
  H: string; // highlight/breast
}

function generateBirdSprite(filename: string, colors: BirdColors) {
  const canvas = createCanvas(128, 32);
  const ctx = canvas.getContext("2d");

  const colorMap: Record<string, string> = {
    B: colors.B,
    W: colors.W,
    E: colors.E,
    K: colors.K,
    T: colors.T,
    H: colors.H,
    ".": "",
  };

  for (let frame = 0; frame < 4; frame++) {
    const frameData = BIRD_FRAMES[frame];
    const offsetX = frame * 32;

    for (let row = 0; row < frameData.length; row++) {
      for (let col = 0; col < 32; col++) {
        const char = frameData[row][col] || ".";
        const color = colorMap[char];
        if (color) {
          ctx.fillStyle = color;
          // Draw 2x pixels for chunkier pixel art look within 32x32
          ctx.fillRect(offsetX + col, row * 2, 1, 2);
        }
      }
    }
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

  // Add some pixel clouds
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

// Robin — red breast, brown body
generateBirdSprite("robin.png", {
  B: "#8B4513",
  W: "#6B3410",
  E: "#0A0A14",
  K: "#FFD700",
  T: "#5C3A1E",
  H: "#E74C3C",
});

// Canary — yellow body
generateBirdSprite("canary.png", {
  B: "#FFD700",
  W: "#FFA500",
  E: "#0A0A14",
  K: "#FF8C00",
  T: "#DAA520",
  H: "#FFED4A",
});

// Bluebird — blue body
generateBirdSprite("bluebird.png", {
  B: "#3498DB",
  W: "#2176AE",
  E: "#0A0A14",
  K: "#FFD700",
  T: "#1A5276",
  H: "#E74C3C",
});

// Ghost — grey bird shape (same bird template, muted colors)
generateBirdSprite("ghost.png", {
  B: "#9E9E9E",
  W: "#757575",
  E: "#424242",
  K: "#BDBDBD",
  T: "#616161",
  H: "#BDBDBD",
});

// Backgrounds
generateBackground("bg-far.png", "#87CEEB", "#5B9BD5");
generateBackground("bg-mid.png", "#87CEEB", "#87CEEB");
generateBackground("bg-near.png", "#4CAF50", "#388E3C");

console.log("\nDone! Sprites now look like actual birds.");
