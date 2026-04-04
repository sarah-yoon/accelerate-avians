/**
 * Generates pixel art bird sprite PNGs for development.
 * Each sprite is 64x16 (four 16x16 frames).
 * Run: npx tsx scripts/generate-placeholders.ts
 */
import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PUBLIC = join(__dirname, "..", "public");

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
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
 * Draw a compact pixel art bird at (ox, oy) within a 16x16 frame.
 * Bird is ~10x9 pixels, styled like the sparrow reference.
 * wingState: 0 = rest, 1 = wing down, 2 = wing up
 */
function drawBird(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  palette: BirdPalette,
  wingState: number,
) {
  const { body, wing, breast, beak, eye, tail, belly } = palette;

  // Offset to center ~10x9 bird in 16x16 frame
  const bx = ox + 3;
  const by = oy + 3;

  // === HEAD (3x3 rounded) ===
  px(ctx, bx + 6, by + 0, body);
  px(ctx, bx + 7, by + 0, body);
  rect(ctx, bx + 5, by + 1, 4, 1, body);
  rect(ctx, bx + 5, by + 2, 4, 1, body);
  px(ctx, bx + 6, by + 3, body);
  px(ctx, bx + 7, by + 3, body);

  // Eye
  px(ctx, bx + 7, by + 1, eye);

  // Beak
  px(ctx, bx + 9, by + 2, beak);
  px(ctx, bx + 8, by + 2, beak);

  // === BODY (6x4 oval) ===
  rect(ctx, bx + 3, by + 3, 5, 1, body);
  rect(ctx, bx + 2, by + 4, 7, 1, body);
  rect(ctx, bx + 2, by + 5, 7, 1, body);
  rect(ctx, bx + 3, by + 6, 5, 1, body);
  rect(ctx, bx + 4, by + 7, 3, 1, body);

  // Breast highlight
  px(ctx, bx + 7, by + 4, breast);
  px(ctx, bx + 8, by + 4, breast);
  px(ctx, bx + 7, by + 5, breast);
  px(ctx, bx + 8, by + 5, breast);

  // Belly
  px(ctx, bx + 4, by + 6, belly);
  px(ctx, bx + 5, by + 6, belly);
  px(ctx, bx + 6, by + 6, belly);

  // === TAIL ===
  px(ctx, bx + 1, by + 4, tail);
  px(ctx, bx + 0, by + 5, tail);
  px(ctx, bx + 1, by + 5, tail);

  // === WING ===
  if (wingState === 0) {
    // Rest
    rect(ctx, bx + 3, by + 4, 3, 1, wing);
    rect(ctx, bx + 3, by + 5, 3, 1, wing);
  } else if (wingState === 1) {
    // Down
    rect(ctx, bx + 3, by + 5, 3, 1, wing);
    rect(ctx, bx + 3, by + 6, 3, 1, wing);
    px(ctx, bx + 4, by + 7, wing);
    px(ctx, bx + 5, by + 7, wing);
    px(ctx, bx + 4, by + 8, wing);
  } else if (wingState === 2) {
    // Up
    px(ctx, bx + 4, by + 1, wing);
    px(ctx, bx + 5, by + 1, wing);
    rect(ctx, bx + 3, by + 2, 3, 1, wing);
    rect(ctx, bx + 3, by + 3, 3, 1, wing);
  }

  // === FEET ===
  px(ctx, bx + 5, by + 8, body);
  px(ctx, bx + 5, by + 9, body);
  px(ctx, bx + 7, by + 8, body);
  px(ctx, bx + 7, by + 9, body);
}

/**
 * Draw a robot bird at (ox, oy) within a 16x16 frame.
 */
function drawRobotBird(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  wingState: number,
) {
  const metal = "#607D8B";
  const darkMetal = "#455A64";
  const lightMetal = "#90A4AE";
  const red = "#F44336";
  const orange = "#FF9800";
  const yellow = "#FFEB3B";

  const bx = ox + 3;
  const by = oy + 2;

  // Antenna
  px(ctx, bx + 7, by + 0, darkMetal);
  px(ctx, bx + 7, by + 1, yellow);

  // Head (boxy 4x3)
  rect(ctx, bx + 5, by + 2, 4, 1, darkMetal);
  rect(ctx, bx + 5, by + 3, 4, 1, metal);
  rect(ctx, bx + 5, by + 4, 4, 1, metal);
  // Eye
  px(ctx, bx + 7, by + 3, red);
  px(ctx, bx + 8, by + 3, red);

  // Beak
  px(ctx, bx + 9, by + 4, lightMetal);

  // Body (boxy 7x4)
  rect(ctx, bx + 2, by + 5, 7, 1, darkMetal);
  rect(ctx, bx + 1, by + 6, 8, 1, metal);
  rect(ctx, bx + 1, by + 7, 8, 1, metal);
  rect(ctx, bx + 2, by + 8, 7, 1, darkMetal);

  // Panel lines
  px(ctx, bx + 4, by + 6, darkMetal);
  px(ctx, bx + 4, by + 7, darkMetal);

  // Chest highlight
  px(ctx, bx + 7, by + 6, lightMetal);
  px(ctx, bx + 8, by + 6, lightMetal);

  // Exhaust
  px(ctx, bx + 0, by + 6, darkMetal);
  px(ctx, bx + 0, by + 7, orange);

  // Wing
  if (wingState === 0) {
    rect(ctx, bx + 3, by + 6, 2, 1, lightMetal);
    rect(ctx, bx + 3, by + 7, 2, 1, darkMetal);
  } else if (wingState === 1) {
    rect(ctx, bx + 3, by + 7, 2, 1, lightMetal);
    rect(ctx, bx + 3, by + 8, 2, 1, darkMetal);
    px(ctx, bx + 3, by + 9, lightMetal);
  } else if (wingState === 2) {
    rect(ctx, bx + 3, by + 3, 2, 1, darkMetal);
    rect(ctx, bx + 3, by + 4, 2, 1, lightMetal);
    rect(ctx, bx + 3, by + 5, 2, 1, darkMetal);
  }

  // Feet
  px(ctx, bx + 4, by + 9, darkMetal);
  px(ctx, bx + 4, by + 10, lightMetal);
  px(ctx, bx + 6, by + 9, darkMetal);
  px(ctx, bx + 6, by + 10, lightMetal);
}

function generateBirdSprite(filename: string, palette: BirdPalette) {
  const canvas = createCanvas(64, 16);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  const wingStates = [0, 1, 2, 1];
  for (let frame = 0; frame < 4; frame++) {
    drawBird(ctx, frame * 16, 0, palette, wingStates[frame]);
  }

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(join(PUBLIC, "sprites", filename), buffer);
  console.log(`Generated ${filename}`);
}

function generateRobotSprite(filename: string) {
  const canvas = createCanvas(64, 16);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  const wingStates = [0, 1, 2, 1];
  for (let frame = 0; frame < 4; frame++) {
    drawRobotBird(ctx, frame * 16, 0, wingStates[frame]);
  }

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(join(PUBLIC, "sprites", filename), buffer);
  console.log(`Generated ${filename}`);
}

// === Generate all bird sprites ===
ensureDir(join(PUBLIC, "sprites"));

// Natural birds — each has a unique color palette
const BIRDS: Record<string, BirdPalette> = {
  "sparrow":      { body: "#8B7355", wing: "#6B5B45", breast: "#C4A882", beak: "#D4A060", eye: "#1a1a2e", tail: "#6B5B45", belly: "#D4C4A8" },
  "robin-bird":   { body: "#6B5B4B", wing: "#4B3B2B", breast: "#E05A3A", beak: "#E8C040", eye: "#1a1a2e", tail: "#4B3B2B", belly: "#C8A878" },
  "cardinal":     { body: "#D42020", wing: "#A01818", breast: "#E83838", beak: "#E8A020", eye: "#1a1a2e", tail: "#901010", belly: "#E85050" },
  "bluejay":      { body: "#4488CC", wing: "#2266AA", breast: "#88BBEE", beak: "#3A3A4A", eye: "#1a1a2e", tail: "#2266AA", belly: "#AACCEE" },
  "eagle":        { body: "#5B3A1A", wing: "#3B2A10", breast: "#7B5A3A", beak: "#E8C040", eye: "#1a1a2e", tail: "#3B2A10", belly: "#9B7A5A" },
  "owl":          { body: "#A08060", wing: "#806040", breast: "#C0A080", beak: "#808060", eye: "#FFD700", tail: "#806040", belly: "#D0C0A0" },
  "falcon":       { body: "#607080", wing: "#405060", breast: "#8090A0", beak: "#505050", eye: "#1a1a2e", tail: "#405060", belly: "#A0B0C0" },
  "toucan":       { body: "#1A1A2E", wing: "#0A0A1E", breast: "#FFFFFF", beak: "#FF8C00", eye: "#1a1a2e", tail: "#0A0A1E", belly: "#F0F0F0" },
  "puffin":       { body: "#1A1A2E", wing: "#0A0A1E", breast: "#FFFFFF", beak: "#FF4500", eye: "#1a1a2e", tail: "#0A0A1E", belly: "#F0F0F0" },
  "peacock":      { body: "#1A8A4A", wing: "#106838", breast: "#2AAA6A", beak: "#505050", eye: "#1a1a2e", tail: "#0A5828", belly: "#3ACC8A" },
  "parrot":       { body: "#20AA20", wing: "#108810", breast: "#FF4040", beak: "#505050", eye: "#1a1a2e", tail: "#108810", belly: "#40CC40" },
  "macaw":        { body: "#DD2020", wing: "#2040CC", breast: "#EE4040", beak: "#303030", eye: "#1a1a2e", tail: "#2040CC", belly: "#FF6060" },
  "duck":         { body: "#2A7A2A", wing: "#1A5A1A", breast: "#8B6914", beak: "#FFB020", eye: "#1a1a2e", tail: "#1A5A1A", belly: "#3A9A3A" },
  "pigeon":       { body: "#808890", wing: "#606870", breast: "#909AA0", beak: "#706860", eye: "#FF4000", tail: "#606870", belly: "#A0AAB0" },
  "seagull":      { body: "#F0F0F0", wing: "#B0B8C0", breast: "#FFFFFF", beak: "#E8A020", eye: "#1a1a2e", tail: "#B0B8C0", belly: "#FFFFFF" },
  "pelican":      { body: "#F0E8E0", wing: "#C0B8B0", breast: "#FFFFFF", beak: "#E8A020", eye: "#1a1a2e", tail: "#C0B8B0", belly: "#FFFFFF" },
  "hummingbird":  { body: "#20CC60", wing: "#1090A0", breast: "#FF2060", beak: "#404040", eye: "#1a1a2e", tail: "#1090A0", belly: "#40EE80" },
  "kingfisher":   { body: "#0088CC", wing: "#006AAA", breast: "#FF6020", beak: "#303030", eye: "#1a1a2e", tail: "#006AAA", belly: "#FF8040" },
  "bee-eater":    { body: "#20BB60", wing: "#1090CC", breast: "#EEB030", beak: "#303030", eye: "#1a1a2e", tail: "#1090CC", belly: "#EECC50" },
  "swallow":      { body: "#1A2A5A", wing: "#0A1A3A", breast: "#CC4020", beak: "#303030", eye: "#1a1a2e", tail: "#0A1A3A", belly: "#FFFFFF" },
  "swift":        { body: "#3A3A3A", wing: "#2A2A2A", breast: "#5A5A5A", beak: "#303030", eye: "#1a1a2e", tail: "#2A2A2A", belly: "#6A6A6A" },
  "albatross":    { body: "#E8E0D8", wing: "#3A3A3A", breast: "#F0E8E0", beak: "#E8A040", eye: "#1a1a2e", tail: "#3A3A3A", belly: "#F8F0E8" },
  "kestrel":      { body: "#B06030", wing: "#805020", breast: "#D08050", beak: "#404040", eye: "#1a1a2e", tail: "#805020", belly: "#E0A070" },
  "red-kite":     { body: "#A04020", wing: "#702010", breast: "#C06040", beak: "#404040", eye: "#E8C040", tail: "#702010", belly: "#D08060" },
  "osprey":       { body: "#4A3A2A", wing: "#3A2A1A", breast: "#FFFFFF", beak: "#303030", eye: "#E8C040", tail: "#3A2A1A", belly: "#F0F0F0" },
  "nightjar":     { body: "#7A6A5A", wing: "#5A4A3A", breast: "#8A7A6A", beak: "#404040", eye: "#FFD700", tail: "#5A4A3A", belly: "#9A8A7A" },
  "snowy-owl":    { body: "#F0F0F0", wing: "#D0D0D0", breast: "#FFFFFF", beak: "#505050", eye: "#FFD700", tail: "#D0D0D0", belly: "#FFFFFF" },
  // Special/fantasy birds
  "glitch":       { body: "#FF00FF", wing: "#00FFFF", breast: "#FFFF00", beak: "#FF0000", eye: "#00FF00", tail: "#00FFFF", belly: "#FF88FF" },
  "nova":         { body: "#FF6600", wing: "#FF3300", breast: "#FFCC00", beak: "#FFE000", eye: "#FFFFFF", tail: "#FF3300", belly: "#FFAA00" },
  "sparq":        { body: "#6020FF", wing: "#4010DD", breast: "#8040FF", beak: "#FFD700", eye: "#00FFFF", tail: "#4010DD", belly: "#A060FF" },
  "sunny":        { body: "#FFD700", wing: "#FFA500", breast: "#FFED4A", beak: "#FF8C00", eye: "#1a1a2e", tail: "#DAA520", belly: "#FFF176" },
  "rex":          { body: "#2A6A2A", wing: "#1A4A1A", breast: "#4A8A4A", beak: "#CC2020", eye: "#FF0000", tail: "#1A4A1A", belly: "#5AAA5A" },
  "prism":        { body: "#88DDFF", wing: "#FF88AA", breast: "#AAFFAA", beak: "#FFDD88", eye: "#FF44FF", tail: "#FF88AA", belly: "#CCFFCC" },
  "king":         { body: "#FFD700", wing: "#DAA520", breast: "#FFF0AA", beak: "#B8860B", eye: "#1a1a2e", tail: "#B8860B", belly: "#FFF8DC" },
  "tank":         { body: "#556B2F", wing: "#3A4A1F", breast: "#6B8A3F", beak: "#404040", eye: "#FF0000", tail: "#3A4A1F", belly: "#7AAA4F" },
};

for (const [name, palette] of Object.entries(BIRDS)) {
  generateBirdSprite(`${name}.png`, palette);
}

// Robot bird for bots
generateRobotSprite("robot.png");

console.log("\nDone! All sprites generated at 64x16 (4x 16x16 frames).");
