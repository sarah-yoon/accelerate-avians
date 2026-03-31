/**
 * Generates minimal placeholder PNGs for development.
 * These should be replaced with real pixel art from itch.io CC0 packs.
 *
 * Run: npx tsx scripts/generate-placeholders.ts
 *
 * Requirements: npm install canvas (node-canvas)
 */
import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PUBLIC = join(__dirname, "..", "public");

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

function generateSpriteSheet(
  filename: string,
  bodyColor: string,
  wingColor: string
) {
  // 4 frames, each 32x32 = 128x32 sprite sheet
  const canvas = createCanvas(128, 32);
  const ctx = canvas.getContext("2d");

  for (let frame = 0; frame < 4; frame++) {
    const x = frame * 32;

    // Body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x + 8, 10, 16, 12);

    // Head
    ctx.fillRect(x + 20, 6, 8, 10);

    // Eye
    ctx.fillStyle = "#0A0A14";
    ctx.fillRect(x + 24, 8, 2, 2);

    // Beak
    ctx.fillStyle = "#FFD700";
    ctx.fillRect(x + 28, 10, 4, 3);

    // Wing (animate position per frame)
    ctx.fillStyle = wingColor;
    const wingOffsets = [0, 3, -3, 3]; // rest, down, up, down
    ctx.fillRect(x + 10, 12 + wingOffsets[frame], 10, 6);

    // Tail
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x + 4, 12, 6, 4);
  }

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(join(PUBLIC, "sprites", filename), buffer);
  console.log(`Generated ${filename}`);
}

function generateGhostSprite() {
  const canvas = createCanvas(128, 32);
  const ctx = canvas.getContext("2d");

  for (let frame = 0; frame < 4; frame++) {
    const x = frame * 32;

    // Draw checkerboard dithered bird shape
    ctx.fillStyle = "rgba(200, 200, 200, 0.6)";
    for (let px = 0; px < 32; px++) {
      for (let py = 0; py < 32; py++) {
        if ((px + py) % 2 === 0) {
          // Simple bird silhouette check
          const bx = px - 8;
          const by = py - 8;
          if (bx >= 0 && bx < 20 && by >= 0 && by < 16) {
            ctx.fillRect(x + px, py, 1, 1);
          }
        }
      }
    }
  }

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(join(PUBLIC, "sprites", "ghost.png"), buffer);
  console.log("Generated ghost.png");
}

function generateBackground(filename: string, color1: string, color2: string) {
  const canvas = createCanvas(480, 135);
  const ctx = canvas.getContext("2d");

  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, 135);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 480, 135);

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(join(PUBLIC, "backgrounds", filename), buffer);
  console.log(`Generated ${filename}`);
}

// Main
ensureDir(join(PUBLIC, "sprites"));
ensureDir(join(PUBLIC, "backgrounds"));

// Birds — colors from spec palette
generateSpriteSheet("robin.png", "#E74C3C", "#C0392B");
generateSpriteSheet("canary.png", "#FFD700", "#FFA500");
generateSpriteSheet("bluebird.png", "#3498DB", "#2980B9");
generateGhostSprite();

// Backgrounds
generateBackground("bg-far.png", "#87CEEB", "#5B9BD5");
generateBackground("bg-mid.png", "#5B9BD500", "#4CAF5040");
generateBackground("bg-near.png", "#4CAF5000", "#388E3C80");

console.log("\nDone! Replace these with real CC0 pixel art from itch.io.");
