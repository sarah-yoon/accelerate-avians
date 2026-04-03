const PX = 4;

interface ProceduralLayer {
  canvas: OffscreenCanvas;
  speed: number;
}

function fillPixel(
  ctx: OffscreenCanvasRenderingContext2D,
  px_x: number,
  py: number,
  color: string,
  size = 1
) {
  ctx.fillStyle = color;
  ctx.fillRect(px_x * PX, py * PX, size * PX, size * PX);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Crossfade the right edge into the left edge so the tile loops seamlessly
function makeSeamless(canvas: OffscreenCanvas, blendWidth?: number): OffscreenCanvas {
  if (canvas.width <= 1) return canvas;
  const w = canvas.width;
  const h = canvas.height;
  const bw = blendWidth ?? Math.floor(w * 0.12); // blend 12% of width
  if (bw <= 0) return canvas;

  const ctx = canvas.getContext("2d")!;
  // Create a temp copy of the full canvas
  const tmp = new OffscreenCanvas(w, h);
  const tCtx = tmp.getContext("2d")!;
  tCtx.drawImage(canvas, 0, 0);

  // Draw the left portion over the right edge with increasing opacity,
  // and the right portion over the left edge with increasing opacity
  for (let x = 0; x < bw; x++) {
    const t = x / bw; // 0 at edge, 1 at blend end

    // Right seam: fade out original, fade in copy of left side
    ctx.globalAlpha = 1 - t;
    ctx.drawImage(tmp, x, 0, 1, h, w - bw + x, 0, 1, h);

    // Left seam: fade out original, fade in copy of right side
    ctx.globalAlpha = t;
    ctx.drawImage(tmp, w - bw + x, 0, 1, h, x, 0, 1, h);
  }
  ctx.globalAlpha = 1;

  return canvas;
}

function fillGradient(
  ctx: OffscreenCanvasRenderingContext2D,
  w: number, h: number,
  stops: { pos: number; r: number; g: number; b: number }[]
) {
  const rows = Math.ceil(h / PX);
  for (let y = 0; y < rows; y++) {
    const t = y / rows;
    let i = 0;
    while (i < stops.length - 2 && stops[i + 1].pos < t) i++;
    const a = stops[i], b = stops[i + 1];
    const lt = (t - a.pos) / (b.pos - a.pos);
    const r = Math.round(a.r + (b.r - a.r) * lt);
    const g = Math.round(a.g + (b.g - a.g) * lt);
    const bl = Math.round(a.b + (b.b - a.b) * lt);
    ctx.fillStyle = `rgb(${r},${g},${bl})`;
    ctx.fillRect(0, y * PX, w, PX);
  }
}

function scatterStars(
  ctx: OffscreenCanvasRenderingContext2D,
  w: number, h: number,
  count: number, colors: string[], maxY: number, seed: number
) {
  const cols = Math.ceil(w / PX);
  const rows = Math.ceil(h / PX);
  const rand = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    const sx = Math.floor(rand() * cols);
    const sy = Math.floor(rand() * Math.floor(rows * maxY));
    ctx.globalAlpha = 0.4 + rand() * 0.6;
    const color = colors[Math.floor(rand() * colors.length)];
    fillPixel(ctx, sx, sy, color);
    if (rand() > 0.7) {
      fillPixel(ctx, sx + 1, sy, color);
      fillPixel(ctx, sx, sy + 1, color);
      fillPixel(ctx, sx + 1, sy + 1, color);
    }
  }
  ctx.globalAlpha = 1;
}

function makeHills(
  ctx: OffscreenCanvasRenderingContext2D,
  w: number, h: number,
  color: string, minPct: number, maxPct: number, seed: number
) {
  const cols = Math.ceil(w / PX);
  const rows = Math.ceil(h / PX);
  const rand = seededRandom(seed);
  const heights: number[] = [];
  let height = rows * ((minPct + maxPct) / 2);
  for (let x = 0; x < cols; x++) {
    height += (rand() - 0.5) * 1.5;
    height = Math.max(rows * minPct, Math.min(rows * maxPct, height));
    heights.push(Math.floor(height));
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let x = 1; x < cols - 1; x++) {
      heights[x] = Math.floor((heights[x - 1] + heights[x] + heights[x + 1]) / 3);
    }
  }
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    heights[cols - 8 + i] = Math.floor(heights[cols - 8 + i] * (1 - t) + heights[i] * t);
  }
  for (let x = 0; x < cols; x++) {
    for (let y = heights[x]; y < rows; y++) {
      fillPixel(ctx, x, y, color);
    }
  }
}

function flatGround(
  ctx: OffscreenCanvasRenderingContext2D,
  w: number, h: number,
  color: string, startPct: number
) {
  const rows = Math.ceil(h / PX);
  const start = Math.floor(rows * startPct);
  ctx.fillStyle = color;
  ctx.fillRect(0, start * PX, w, (rows - start) * PX);
}

// ==================== BACKGROUND THEMES ====================

function generateSunset(w: number, h: number): ProceduralLayer[] {
  const sky = new OffscreenCanvas(w, h);
  const sCtx = sky.getContext("2d")!;
  fillGradient(sCtx, w, h, [
    { pos: 0, r: 26, g: 10, b: 46 },
    { pos: 0.5, r: 45, g: 27, b: 105 },
    { pos: 1, r: 80, g: 40, b: 90 },
  ]);
  scatterStars(sCtx, w, h, 25, ["#d4c8ff"], 0.6, 42);

  const sun = new OffscreenCanvas(w, h);
  const suCtx = sun.getContext("2d")!;
  const cols = Math.ceil(w / PX), rows = Math.ceil(h / PX);
  const cx = Math.floor(cols * 0.5), cy = Math.floor(rows * 0.7);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= 12) {
        fillPixel(suCtx, x, y, d < 5 ? "#f8c060" : d < 8 ? "#f09030" : "#e05870");
      } else if (d < 22) {
        suCtx.globalAlpha = (1 - (d - 12) / 10) * 0.35;
        fillPixel(suCtx, x, y, "#e8721a");
        suCtx.globalAlpha = 1;
      }
    }
  }

  const haze = new OffscreenCanvas(w, h);
  const hCtx = haze.getContext("2d")!;
  const startRow = Math.floor(rows * 0.45);
  for (let y = startRow; y < rows; y++) {
    const t = (y - startRow) / (rows - startRow);
    hCtx.globalAlpha = 0.15 + t * 0.35;
    hCtx.fillStyle = `rgb(${240 - t * 16},${168 - t * 75},${130 - t * 48})`;
    hCtx.fillRect(0, y * PX, w, PX);
  }
  hCtx.globalAlpha = 1;

  const clouds = new OffscreenCanvas(w, h);
  const cCtx = clouds.getContext("2d")!;
  const rand = seededRandom(77);
  const cloudDefs = [
    { x: 5, y: Math.floor(rows * 0.42), w: 14, h: 4 },
    { x: 35, y: Math.floor(rows * 0.48), w: 18, h: 5 },
    { x: 65, y: Math.floor(rows * 0.44), w: 12, h: 3 },
    { x: 90, y: Math.floor(rows * 0.50), w: 16, h: 4 },
  ];
  for (const cl of cloudDefs) {
    for (let cy2 = 0; cy2 < cl.h; cy2++) {
      const inset = cy2 === 0 || cy2 === cl.h - 1 ? 2 : 0;
      for (let cx2 = 0; cx2 < cl.w - inset * 2; cx2++) {
        cCtx.globalAlpha = 0.5 + rand() * 0.3;
        fillPixel(cCtx, (cl.x + inset + cx2) % cols, cl.y + cy2, cy2 / cl.h < 0.5 ? "#8b2d6b" : "#5c2d82");
      }
    }
  }
  cCtx.globalAlpha = 1;

  const hills = new OffscreenCanvas(w, h);
  const hiCtx = hills.getContext("2d")!;
  makeHills(hiCtx, w, h, "#2a0f14", 0.55, 0.78, 123);

  const ground = new OffscreenCanvas(w, h);
  const gCtx = ground.getContext("2d")!;
  flatGround(gCtx, w, h, "#0f0a0c", 0.85);

  return [
    { canvas: sky, speed: 0.05 }, { canvas: sun, speed: 0.15 },
    { canvas: haze, speed: 0.30 }, { canvas: clouds, speed: 0.50 },
    { canvas: hills, speed: 0.75 }, { canvas: ground, speed: 1.00 },
  ];
}

function generateCityNight(w: number, h: number): ProceduralLayer[] {
  const sky = new OffscreenCanvas(w, h);
  const sCtx = sky.getContext("2d")!;
  fillGradient(sCtx, w, h, [
    { pos: 0, r: 5, g: 5, b: 20 },
    { pos: 0.7, r: 15, g: 12, b: 40 },
    { pos: 1, r: 25, g: 15, b: 50 },
  ]);
  scatterStars(sCtx, w, h, 40, ["#ffffff", "#d4d4ff", "#ffffcc"], 0.6, 100);
  // Moon
  const cols = Math.ceil(w / PX), rows = Math.ceil(h / PX);
  const mx = Math.floor(cols * 0.75), my = Math.floor(rows * 0.15);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
      if (d <= 6) fillPixel(sCtx, x, y, d < 4 ? "#f0f0e0" : "#d8d8c8");
    }
  }

  const glow = new OffscreenCanvas(w, h);
  const glCtx = glow.getContext("2d")!;
  for (let y = Math.floor(rows * 0.6); y < rows; y++) {
    const t = (y - rows * 0.6) / (rows * 0.4);
    glCtx.globalAlpha = t * 0.2;
    glCtx.fillStyle = "#6030a0";
    glCtx.fillRect(0, y * PX, w, PX);
  }
  glCtx.globalAlpha = 1;

  const skyline1 = new OffscreenCanvas(w, h);
  const s1Ctx = skyline1.getContext("2d")!;
  const rand1 = seededRandom(201);
  for (let x = 0; x < cols; x += 3) {
    const bh = 8 + Math.floor(rand1() * 15);
    const by = rows - bh;
    for (let bx = x; bx < Math.min(x + 3, cols); bx++) {
      for (let yy = by; yy < rows; yy++) fillPixel(s1Ctx, bx, yy, "#151525");
    }
    if (rand1() > 0.4) fillPixel(s1Ctx, x + 1, by + 2, "#ffdd44");
    if (rand1() > 0.5) fillPixel(s1Ctx, x + 1, by + 5, "#ffdd44");
  }

  const skyline2 = new OffscreenCanvas(w, h);
  const s2Ctx = skyline2.getContext("2d")!;
  const rand2 = seededRandom(301);
  for (let x = 1; x < cols; x += 4) {
    const bh = 5 + Math.floor(rand2() * 12);
    const by = rows - bh;
    for (let bx = x; bx < Math.min(x + 3, cols); bx++) {
      for (let yy = by; yy < rows; yy++) fillPixel(s2Ctx, bx, yy, "#0a0a18");
    }
    if (rand2() > 0.3) fillPixel(s2Ctx, x + 1, by + 1, "#ffcc33");
    if (rand2() > 0.4) fillPixel(s2Ctx, x + 1, by + 3, "#ffcc33");
    if (rand2() > 0.5) fillPixel(s2Ctx, x, by + 4, "#ffcc33");
  }

  const ground = new OffscreenCanvas(w, h);
  const gCtx = ground.getContext("2d")!;
  flatGround(gCtx, w, h, "#050510", 0.92);

  return [
    { canvas: sky, speed: 0.05 }, { canvas: glow, speed: 0.15 },
    { canvas: skyline1, speed: 0.40 }, { canvas: skyline2, speed: 0.65 },
    { canvas: ground, speed: 1.00 }, { canvas: new OffscreenCanvas(1, 1), speed: 0 },
  ];
}

function generateDeepSpace(w: number, h: number): ProceduralLayer[] {
  const bg = new OffscreenCanvas(w, h);
  const bCtx = bg.getContext("2d")!;
  bCtx.fillStyle = "#030308";
  bCtx.fillRect(0, 0, w, h);
  scatterStars(bCtx, w, h, 80, ["#ffffff", "#aaccff", "#ffffaa"], 1.0, 50);

  // Milky way band
  const mw = new OffscreenCanvas(w, h);
  const mCtx = mw.getContext("2d")!;
  const cols = Math.ceil(w / PX), rows = Math.ceil(h / PX);
  const rand = seededRandom(333);
  for (let i = 0; i < 300; i++) {
    const t = rand();
    const bx = Math.floor(t * cols);
    const by = Math.floor((t * 0.6 + 0.2 + (rand() - 0.5) * 0.15) * rows);
    mCtx.globalAlpha = 0.1 + rand() * 0.15;
    fillPixel(mCtx, bx, by, rand() > 0.5 ? "#332255" : "#221144");
  }
  mCtx.globalAlpha = 1;

  // Nebula
  const neb = new OffscreenCanvas(w, h);
  const nCtx = neb.getContext("2d")!;
  const ncx = Math.floor(cols * 0.5), ncy = Math.floor(rows * 0.45);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = Math.sqrt((x - ncx) ** 2 + (y - ncy) ** 2);
      if (d < 18) {
        nCtx.globalAlpha = Math.max(0, (1 - d / 18) * 0.25);
        fillPixel(nCtx, x, y, d < 8 ? "#cc44aa" : "#7733aa");
      }
    }
  }
  nCtx.globalAlpha = 1;

  // Planet with rings
  const planet = new OffscreenCanvas(w, h);
  const pCtx = planet.getContext("2d")!;
  const ppx = Math.floor(cols * 0.85), ppy = Math.floor(rows * 0.25);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = Math.sqrt((x - ppx) ** 2 + (y - ppy) ** 2);
      if (d <= 5) fillPixel(pCtx, x, y, d < 3 ? "#886644" : "#664422");
      if (Math.abs(y - ppy) <= 1 && d > 5 && d < 10) {
        pCtx.globalAlpha = 0.4;
        fillPixel(pCtx, x, y, "#998866");
        pCtx.globalAlpha = 1;
      }
    }
  }

  const empty = new OffscreenCanvas(1, 1);
  return [
    { canvas: bg, speed: 0.03 }, { canvas: mw, speed: 0.08 },
    { canvas: neb, speed: 0.15 }, { canvas: planet, speed: 0.25 },
    { canvas: empty, speed: 0 }, { canvas: empty, speed: 0 },
  ];
}

function generateStorm(w: number, h: number): ProceduralLayer[] {
  const sky = new OffscreenCanvas(w, h);
  const sCtx = sky.getContext("2d")!;
  fillGradient(sCtx, w, h, [
    { pos: 0, r: 30, g: 30, b: 35 },
    { pos: 0.6, r: 40, g: 42, b: 45 },
    { pos: 0.85, r: 60, g: 70, b: 40 },
    { pos: 1, r: 40, g: 50, b: 30 },
  ]);

  const clouds1 = new OffscreenCanvas(w, h);
  const c1Ctx = clouds1.getContext("2d")!;
  const cols = Math.ceil(w / PX), rows = Math.ceil(h / PX);
  const rand1 = seededRandom(444);
  for (let i = 0; i < 8; i++) {
    const cx = Math.floor(rand1() * cols);
    const cy = Math.floor(rows * 0.1 + rand1() * rows * 0.35);
    const cw = 10 + Math.floor(rand1() * 15);
    const ch = 3 + Math.floor(rand1() * 3);
    for (let dy = 0; dy < ch; dy++) {
      const inset = dy === 0 || dy === ch - 1 ? 2 : 0;
      for (let dx = inset; dx < cw - inset; dx++) {
        c1Ctx.globalAlpha = 0.5 + rand1() * 0.4;
        fillPixel(c1Ctx, (cx + dx) % cols, cy + dy, rand1() > 0.5 ? "#2a2a30" : "#353540");
      }
    }
  }
  c1Ctx.globalAlpha = 1;

  // Lightning
  const lightning = new OffscreenCanvas(w, h);
  const lCtx = lightning.getContext("2d")!;
  const rand2 = seededRandom(555);
  for (let bolt = 0; bolt < 2; bolt++) {
    let bx = Math.floor(rand2() * cols);
    let by = Math.floor(rows * 0.15);
    for (let seg = 0; seg < 12; seg++) {
      fillPixel(lCtx, bx, by, "#ffffcc");
      fillPixel(lCtx, bx + 1, by, "#ffff88");
      by += 1;
      bx += Math.floor(rand2() * 3) - 1;
    }
  }

  // Rain
  const rain = new OffscreenCanvas(w, h);
  const rCtx = rain.getContext("2d")!;
  const rand3 = seededRandom(666);
  for (let i = 0; i < 100; i++) {
    const rx = Math.floor(rand3() * cols);
    const ry = Math.floor(rand3() * rows);
    rCtx.globalAlpha = 0.15 + rand3() * 0.2;
    fillPixel(rCtx, rx, ry, "#aabbcc");
    fillPixel(rCtx, rx + 1, ry + 1, "#8899aa");
  }
  rCtx.globalAlpha = 1;

  const ground = new OffscreenCanvas(w, h);
  const gCtx = ground.getContext("2d")!;
  flatGround(gCtx, w, h, "#1a1a1e", 0.88);

  const empty = new OffscreenCanvas(1, 1);
  return [
    { canvas: sky, speed: 0.05 }, { canvas: clouds1, speed: 0.25 },
    { canvas: lightning, speed: 0.10 }, { canvas: rain, speed: 0.80 },
    { canvas: ground, speed: 1.00 }, { canvas: empty, speed: 0 },
  ];
}

function generateSpring(w: number, h: number): ProceduralLayer[] {
  const sky = new OffscreenCanvas(w, h);
  const sCtx = sky.getContext("2d")!;
  fillGradient(sCtx, w, h, [
    { pos: 0, r: 150, g: 200, b: 240 },
    { pos: 0.6, r: 190, g: 215, b: 240 },
    { pos: 1, r: 240, g: 190, b: 200 },
  ]);

  const clouds = new OffscreenCanvas(w, h);
  const cCtx = clouds.getContext("2d")!;
  const cols = Math.ceil(w / PX), rows = Math.ceil(h / PX);
  const rand = seededRandom(777);
  for (let i = 0; i < 6; i++) {
    const cx = Math.floor(rand() * cols);
    const cy = 2 + Math.floor(rand() * rows * 0.3);
    const cw = 8 + Math.floor(rand() * 10);
    const ch = 2 + Math.floor(rand() * 2);
    for (let dy = 0; dy < ch; dy++) {
      for (let dx = (dy === 0 ? 1 : 0); dx < cw - (dy === 0 ? 1 : 0); dx++) {
        cCtx.globalAlpha = 0.6 + rand() * 0.3;
        fillPixel(cCtx, (cx + dx) % cols, cy + dy, rand() > 0.3 ? "#ffffff" : "#ffddee");
      }
    }
  }
  cCtx.globalAlpha = 1;

  // Cherry blossom trees
  const trees = new OffscreenCanvas(w, h);
  const tCtx = trees.getContext("2d")!;
  const rand2 = seededRandom(888);
  for (let t = 0; t < 5; t++) {
    const tx = Math.floor(rand2() * cols);
    const ty = Math.floor(rows * 0.7);
    // Trunk
    for (let y = ty; y < rows; y++) fillPixel(tCtx, tx, y, "#5a3a20");
    fillPixel(tCtx, tx + 1, ty + 1, "#5a3a20");
    fillPixel(tCtx, tx - 1, ty + 1, "#5a3a20");
    // Blossoms
    for (let i = 0; i < 20; i++) {
      const bx = tx + Math.floor((rand2() - 0.5) * 8);
      const by = ty - 2 + Math.floor((rand2() - 0.5) * 5);
      tCtx.globalAlpha = 0.7 + rand2() * 0.3;
      fillPixel(tCtx, bx % cols, Math.max(0, by), rand2() > 0.4 ? "#ff88aa" : "#ffaacc");
    }
  }
  tCtx.globalAlpha = 1;

  // Petals
  const petals = new OffscreenCanvas(w, h);
  const pCtx = petals.getContext("2d")!;
  const rand3 = seededRandom(999);
  for (let i = 0; i < 15; i++) {
    pCtx.globalAlpha = 0.4 + rand3() * 0.4;
    fillPixel(pCtx, Math.floor(rand3() * cols), Math.floor(rand3() * rows), rand3() > 0.5 ? "#ff88aa" : "#ffccdd");
  }
  pCtx.globalAlpha = 1;

  const ground = new OffscreenCanvas(w, h);
  const gCtx = ground.getContext("2d")!;
  flatGround(gCtx, w, h, "#55aa55", 0.90);

  return [
    { canvas: sky, speed: 0.05 }, { canvas: clouds, speed: 0.20 },
    { canvas: petals, speed: 0.45 }, { canvas: trees, speed: 0.70 },
    { canvas: ground, speed: 1.00 }, { canvas: new OffscreenCanvas(1, 1), speed: 0 },
  ];
}

function generateRetro8Bit(w: number, h: number): ProceduralLayer[] {
  const sky = new OffscreenCanvas(w, h);
  const sCtx = sky.getContext("2d")!;
  sCtx.fillStyle = "#5c94fc";
  sCtx.fillRect(0, 0, w, h);

  // Sun
  const cols = Math.ceil(w / PX), rows = Math.ceil(h / PX);
  const sunX = Math.floor(cols * 0.85), sunY = Math.floor(rows * 0.12);
  for (let y = sunY - 3; y <= sunY + 3; y++) {
    for (let x = sunX - 3; x <= sunX + 3; x++) fillPixel(sCtx, x, y, "#fcfc54");
  }
  // Rays
  for (let i = -5; i <= 5; i++) { fillPixel(sCtx, sunX + i, sunY - 5, "#fcfc54"); fillPixel(sCtx, sunX + i, sunY + 5, "#fcfc54"); }
  for (let i = -5; i <= 5; i++) { fillPixel(sCtx, sunX - 5, sunY + i, "#fcfc54"); fillPixel(sCtx, sunX + 5, sunY + i, "#fcfc54"); }

  // Clouds — chunky Mario-style
  const clouds = new OffscreenCanvas(w, h);
  const cCtx = clouds.getContext("2d")!;
  const rand = seededRandom(111);
  for (let c = 0; c < 4; c++) {
    const cx = Math.floor(rand() * cols);
    const cy = 3 + Math.floor(rand() * 6);
    // 2-tier block cloud
    for (let dx = 0; dx < 6; dx++) fillPixel(cCtx, (cx + dx) % cols, cy, "#ffffff");
    for (let dx = 1; dx < 5; dx++) fillPixel(cCtx, (cx + dx) % cols, cy - 1, "#ffffff");
    for (let dx = 2; dx < 4; dx++) fillPixel(cCtx, (cx + dx) % cols, cy - 2, "#ffffff");
    for (let dx = 0; dx < 6; dx++) fillPixel(cCtx, (cx + dx) % cols, cy + 1, "#ffffff");
  }

  // Green hills
  const hills = new OffscreenCanvas(w, h);
  const hCtx = hills.getContext("2d")!;
  makeHills(hCtx, w, h, "#00a800", 0.65, 0.80, 222);

  const ground = new OffscreenCanvas(w, h);
  const gCtx = ground.getContext("2d")!;
  flatGround(gCtx, w, h, "#c84c0c", 0.88);
  // Brick pattern
  const gRows = Math.ceil(h / PX);
  const gStart = Math.floor(gRows * 0.88);
  for (let y = gStart; y < gRows; y++) {
    const offset = (y % 2 === 0) ? 0 : 2;
    for (let x = offset; x < cols; x += 4) fillPixel(gCtx, x, y, "#a83800");
  }

  const empty = new OffscreenCanvas(1, 1);
  return [
    { canvas: sky, speed: 0.05 }, { canvas: clouds, speed: 0.20 },
    { canvas: hills, speed: 0.60 }, { canvas: ground, speed: 1.00 },
    { canvas: empty, speed: 0 }, { canvas: empty, speed: 0 },
  ];
}

function generateCyberpunk(w: number, h: number): ProceduralLayer[] {
  const sky = new OffscreenCanvas(w, h);
  const sCtx = sky.getContext("2d")!;
  fillGradient(sCtx, w, h, [
    { pos: 0, r: 8, g: 5, b: 15 },
    { pos: 0.7, r: 20, g: 8, b: 30 },
    { pos: 0.9, r: 60, g: 15, b: 50 },
    { pos: 1, r: 20, g: 40, b: 80 },
  ]);
  scatterStars(sCtx, w, h, 30, ["#ff44aa", "#44ffff", "#ffff44"], 0.7, 1234);

  // Grid lines
  const grid = new OffscreenCanvas(w, h);
  const grCtx = grid.getContext("2d")!;
  const cols = Math.ceil(w / PX), rows = Math.ceil(h / PX);
  for (let y = 0; y < rows; y += 6) {
    grCtx.globalAlpha = 0.06;
    grCtx.fillStyle = "#ff00ff";
    grCtx.fillRect(0, y * PX, w, 1);
  }
  for (let x = 0; x < cols; x += 8) {
    grCtx.fillRect(x * PX, 0, 1, h);
  }
  grCtx.globalAlpha = 1;

  // Magenta moon
  const moon = new OffscreenCanvas(w, h);
  const mCtx = moon.getContext("2d")!;
  const mx = Math.floor(cols * 0.3), my = Math.floor(rows * 0.2);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
      if (d <= 10) {
        fillPixel(mCtx, x, y, d < 5 ? "#ff66aa" : d < 8 ? "#cc3388" : "#881155");
      } else if (d < 16) {
        mCtx.globalAlpha = (1 - (d - 10) / 6) * 0.2;
        fillPixel(mCtx, x, y, "#ff44aa");
        mCtx.globalAlpha = 1;
      }
    }
  }

  // Glitch artifacts
  const glitch = new OffscreenCanvas(w, h);
  const glCtx = glitch.getContext("2d")!;
  const rand = seededRandom(5678);
  for (let i = 0; i < 8; i++) {
    glCtx.globalAlpha = 0.15 + rand() * 0.15;
    const gy = Math.floor(rand() * rows);
    const gx = Math.floor(rand() * cols);
    const gw = 2 + Math.floor(rand() * 6);
    glCtx.fillStyle = rand() > 0.5 ? "#00ffff" : "#ff00ff";
    glCtx.fillRect(gx * PX, gy * PX, gw * PX, PX);
  }
  glCtx.globalAlpha = 1;

  const ground = new OffscreenCanvas(w, h);
  const gCtx = ground.getContext("2d")!;
  flatGround(gCtx, w, h, "#080410", 0.88);

  return [
    { canvas: sky, speed: 0.05 }, { canvas: grid, speed: 0.08 },
    { canvas: moon, speed: 0.12 }, { canvas: glitch, speed: 0.35 },
    { canvas: ground, speed: 1.00 }, { canvas: new OffscreenCanvas(1, 1), speed: 0 },
  ];
}

function generateArctic(w: number, h: number): ProceduralLayer[] {
  const sky = new OffscreenCanvas(w, h);
  const sCtx = sky.getContext("2d")!;
  fillGradient(sCtx, w, h, [
    { pos: 0, r: 5, g: 15, b: 25 },
    { pos: 1, r: 10, g: 25, b: 35 },
  ]);
  scatterStars(sCtx, w, h, 50, ["#ffffff", "#ddeeff"], 0.7, 800);

  // Aurora layers
  const aurora1 = new OffscreenCanvas(w, h);
  const a1Ctx = aurora1.getContext("2d")!;
  const cols = Math.ceil(w / PX), rows = Math.ceil(h / PX);
  const rand1 = seededRandom(900);
  for (let x = 0; x < cols; x++) {
    const h1 = 5 + Math.floor(rand1() * 15);
    const startY = 5 + Math.floor(rand1() * 5);
    for (let y = startY; y < startY + h1; y++) {
      const t = (y - startY) / h1;
      a1Ctx.globalAlpha = (1 - Math.abs(t - 0.5) * 2) * 0.3;
      fillPixel(a1Ctx, x, y, rand1() > 0.5 ? "#33ff88" : "#22cc66");
    }
  }
  a1Ctx.globalAlpha = 1;

  const aurora2 = new OffscreenCanvas(w, h);
  const a2Ctx = aurora2.getContext("2d")!;
  const rand2 = seededRandom(901);
  for (let x = 0; x < cols; x += 2) {
    const h2 = 3 + Math.floor(rand2() * 10);
    const startY2 = 8 + Math.floor(rand2() * 8);
    for (let y = startY2; y < startY2 + h2; y++) {
      const t = (y - startY2) / h2;
      a2Ctx.globalAlpha = (1 - Math.abs(t - 0.5) * 2) * 0.2;
      fillPixel(a2Ctx, x, y, rand2() > 0.6 ? "#44dddd" : "#8844cc");
    }
  }
  a2Ctx.globalAlpha = 1;

  const snow = new OffscreenCanvas(w, h);
  const snCtx = snow.getContext("2d")!;
  flatGround(snCtx, w, h, "#e0e8f0", 0.82);
  flatGround(snCtx, w, h, "#f0f4f8", 0.88);

  const empty = new OffscreenCanvas(1, 1);
  return [
    { canvas: sky, speed: 0.03 }, { canvas: aurora1, speed: 0.10 },
    { canvas: aurora2, speed: 0.18 }, { canvas: snow, speed: 0.80 },
    { canvas: empty, speed: 0 }, { canvas: empty, speed: 0 },
  ];
}

function generateOvercast(w: number, h: number): ProceduralLayer[] {
  const sky = new OffscreenCanvas(w, h);
  const sCtx = sky.getContext("2d")!;
  fillGradient(sCtx, w, h, [
    { pos: 0, r: 180, g: 185, b: 195 },
    { pos: 0.4, r: 195, g: 200, b: 210 },
    { pos: 1, r: 220, g: 222, b: 225 },
  ]);
  // Bright sun patch
  const cols = Math.ceil(w / PX), rows = Math.ceil(h / PX);
  const sx = Math.floor(cols * 0.5), sy = Math.floor(rows * 0.15);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = Math.sqrt((x - sx) ** 2 + (y - sy) ** 2);
      if (d < 12) {
        sCtx.globalAlpha = (1 - d / 12) * 0.15;
        fillPixel(sCtx, x, y, "#ffffff");
      }
    }
  }
  sCtx.globalAlpha = 1;

  const makeCloudLayer = (seed: number, alpha: number, color1: string, color2: string) => {
    const c = new OffscreenCanvas(w, h);
    const cCtx = c.getContext("2d")!;
    const rand = seededRandom(seed);
    for (let i = 0; i < 10; i++) {
      const cx = Math.floor(rand() * cols);
      const cy = Math.floor(rand() * rows * 0.7);
      const cw = 12 + Math.floor(rand() * 18);
      const ch = 3 + Math.floor(rand() * 3);
      for (let dy = 0; dy < ch; dy++) {
        for (let dx = (dy === 0 ? 2 : 0); dx < cw - (dy === 0 ? 2 : 0); dx++) {
          cCtx.globalAlpha = alpha * (0.6 + rand() * 0.4);
          fillPixel(cCtx, (cx + dx) % cols, cy + dy, rand() > 0.5 ? color1 : color2);
        }
      }
    }
    cCtx.globalAlpha = 1;
    return c;
  };

  const fog = new OffscreenCanvas(w, h);
  const fCtx = fog.getContext("2d")!;
  for (let y = Math.floor(rows * 0.75); y < rows; y++) {
    const t = (y - rows * 0.75) / (rows * 0.25);
    fCtx.globalAlpha = t * 0.6;
    fCtx.fillStyle = "#e8e8ee";
    fCtx.fillRect(0, y * PX, w, PX);
  }
  fCtx.globalAlpha = 1;

  return [
    { canvas: sky, speed: 0.05 },
    { canvas: makeCloudLayer(1100, 0.4, "#b8bcc5", "#c8ccd5"), speed: 0.12 },
    { canvas: makeCloudLayer(1200, 0.5, "#a0a4ad", "#b0b4bd"), speed: 0.25 },
    { canvas: makeCloudLayer(1300, 0.35, "#c0c4cd", "#d0d4dd"), speed: 0.40 },
    { canvas: fog, speed: 0.70 },
    { canvas: new OffscreenCanvas(1, 1), speed: 0 },
  ];
}

function generateTropicalDusk(w: number, h: number): ProceduralLayer[] {
  const sky = new OffscreenCanvas(w, h);
  const sCtx = sky.getContext("2d")!;
  fillGradient(sCtx, w, h, [
    { pos: 0, r: 20, g: 80, b: 100 },
    { pos: 0.4, r: 60, g: 90, b: 110 },
    { pos: 0.65, r: 220, g: 130, b: 70 },
    { pos: 0.8, r: 240, g: 100, b: 80 },
    { pos: 1, r: 200, g: 80, b: 60 },
  ]);

  // Clouds
  const clouds = new OffscreenCanvas(w, h);
  const cCtx = clouds.getContext("2d")!;
  const cols = Math.ceil(w / PX), rows = Math.ceil(h / PX);
  const rand = seededRandom(1400);
  for (let i = 0; i < 4; i++) {
    const cx = Math.floor(rand() * cols);
    const cy = Math.floor(rows * 0.2 + rand() * rows * 0.25);
    const cw = 10 + Math.floor(rand() * 12);
    for (let dx = 0; dx < cw; dx++) {
      cCtx.globalAlpha = 0.4 + rand() * 0.3;
      fillPixel(cCtx, (cx + dx) % cols, cy, rand() > 0.5 ? "#ffcc66" : "#cc88cc");
      fillPixel(cCtx, (cx + dx) % cols, cy + 1, rand() > 0.5 ? "#ddaa55" : "#aa66aa");
    }
  }
  cCtx.globalAlpha = 1;

  // Sun on horizon
  const sun = new OffscreenCanvas(w, h);
  const suCtx = sun.getContext("2d")!;
  const sunCx = Math.floor(cols * 0.4), sunCy = Math.floor(rows * 0.78);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = Math.sqrt((x - sunCx) ** 2 + (y - sunCy) ** 2);
      if (d <= 8) fillPixel(suCtx, x, y, d < 4 ? "#ffcc44" : d < 6 ? "#ff9944" : "#ee7733");
      else if (d < 14) {
        suCtx.globalAlpha = (1 - (d - 8) / 6) * 0.25;
        fillPixel(suCtx, x, y, "#ff8833");
        suCtx.globalAlpha = 1;
      }
    }
  }

  // Ocean + reflection
  const ocean = new OffscreenCanvas(w, h);
  const oCtx = ocean.getContext("2d")!;
  const waterStart = Math.floor(rows * 0.78);
  for (let y = waterStart; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const t = (y - waterStart) / (rows - waterStart);
      oCtx.fillStyle = `rgb(${20 + t * 10},${50 + t * 15},${80 + t * 20})`;
      oCtx.fillRect(x * PX, y * PX, PX, PX);
    }
  }
  // Sun reflection trail
  const rand2 = seededRandom(1500);
  for (let y = waterStart; y < rows; y++) {
    for (let i = -3; i <= 3; i++) {
      oCtx.globalAlpha = 0.15 + rand2() * 0.2;
      fillPixel(oCtx, sunCx + i + Math.floor((rand2() - 0.5) * 3), y, "#ffaa44");
    }
  }
  oCtx.globalAlpha = 1;

  // Waves
  const waves = new OffscreenCanvas(w, h);
  const wCtx = waves.getContext("2d")!;
  const rand3 = seededRandom(1600);
  for (let x = 0; x < cols; x += 3) {
    wCtx.globalAlpha = 0.3;
    fillPixel(wCtx, x, waterStart, "#ffffff");
    if (rand3() > 0.5) fillPixel(wCtx, x + 1, waterStart, "#ffffff");
  }
  wCtx.globalAlpha = 1;

  return [
    { canvas: sky, speed: 0.05 }, { canvas: sun, speed: 0.10 },
    { canvas: clouds, speed: 0.25 }, { canvas: ocean, speed: 0.60 },
    { canvas: waves, speed: 0.85 }, { canvas: new OffscreenCanvas(1, 1), speed: 0 },
  ];
}

// ==================== MAIN RENDERER ====================

const BACKGROUNDS = [
  generateSunset, generateCityNight, generateDeepSpace, generateStorm,
  generateSpring, generateRetro8Bit, generateCyberpunk, generateArctic,
  generateOvercast, generateTropicalDusk,
];

export class ParallaxRenderer {
  private layers: ProceduralLayer[] = [];
  private scrollX = 0;
  private generated = false;

  generate(canvasWidth: number, canvasHeight: number): void {
    if (this.generated) return;
    const gen = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];
    this.layers = gen(canvasWidth, canvasHeight);
    // Make every layer tile seamlessly
    for (const layer of this.layers) {
      if (layer.canvas.width > 1) {
        makeSeamless(layer.canvas);
      }
    }
    this.generated = true;
  }

  addLayer(_image: HTMLImageElement, _speed: number): void {}

  update(deltaX: number): void {
    this.scrollX += deltaX;
  }

  draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    this.generate(canvasWidth, canvasHeight);
    for (const layer of this.layers) {
      if (layer.canvas.width <= 1) continue;
      const offset = -(this.scrollX * layer.speed) % canvasWidth;
      ctx.drawImage(layer.canvas, offset, 0, canvasWidth, canvasHeight);
      ctx.drawImage(layer.canvas, offset + canvasWidth, 0, canvasWidth, canvasHeight);
      if (offset > 0) {
        ctx.drawImage(layer.canvas, offset - canvasWidth, 0, canvasWidth, canvasHeight);
      }
    }
  }

  reset(): void {
    this.scrollX = 0;
    this.generated = false;
    this.layers = [];
  }
}
