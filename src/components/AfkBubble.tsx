"use client";

import { useEffect, useRef } from "react";

const SCALE = 2;
const W = 40; // design width
const H = 32; // design height

const BORDER_COLOR = "#5b8dd9";
const BG_COLOR = "#ffffff";
const Z_COLOR = "#1a2a4a";

// Small Z (5x5)
const Z_SMALL: [number, number][] = [
  [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
  [3, 1],
  [2, 2],
  [1, 3],
  [0, 4], [1, 4], [2, 4], [3, 4], [4, 4],
];

// Medium Z (6x6)
const Z_MED: [number, number][] = [
  [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
  [4, 1],
  [3, 2],
  [2, 3],
  [1, 4],
  [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5],
];

// Large Z (7x7)
const Z_LARGE: [number, number][] = [
  [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
  [5, 1],
  [4, 2],
  [3, 3],
  [2, 4],
  [1, 5],
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6],
];

function drawPixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  alpha = 1,
) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  offsetY: number,
  borderAlpha: number,
) {
  const bx = 0;
  const by = Math.round(offsetY);
  const bw = 40;
  const bh = 24;

  // Fill interior
  for (let y = by + 1; y < by + bh - 1; y++) {
    for (let x = bx + 1; x < bx + bw - 1; x++) {
      drawPixel(ctx, x, y, BG_COLOR);
    }
  }

  // Top and bottom edges (inset by 2 for rounded corners)
  for (let x = bx + 2; x < bx + bw - 2; x++) {
    drawPixel(ctx, x, by, BORDER_COLOR, borderAlpha);
    drawPixel(ctx, x, by + bh - 1, BORDER_COLOR, borderAlpha);
  }

  // Left and right edges (inset by 2 for rounded corners)
  for (let y = by + 2; y < by + bh - 2; y++) {
    drawPixel(ctx, bx, y, BORDER_COLOR, borderAlpha);
    drawPixel(ctx, bx + bw - 1, y, BORDER_COLOR, borderAlpha);
  }

  // Rounded corners — single pixel steps
  // Top-left
  drawPixel(ctx, bx + 1, by, BORDER_COLOR, borderAlpha);
  drawPixel(ctx, bx, by + 1, BORDER_COLOR, borderAlpha);
  drawPixel(ctx, bx + 1, by + 1, BG_COLOR); // fill inner corner
  // Top-right
  drawPixel(ctx, bx + bw - 2, by, BORDER_COLOR, borderAlpha);
  drawPixel(ctx, bx + bw - 1, by + 1, BORDER_COLOR, borderAlpha);
  drawPixel(ctx, bx + bw - 2, by + 1, BG_COLOR);
  // Bottom-left
  drawPixel(ctx, bx + 1, by + bh - 1, BORDER_COLOR, borderAlpha);
  drawPixel(ctx, bx, by + bh - 2, BORDER_COLOR, borderAlpha);
  drawPixel(ctx, bx + 1, by + bh - 2, BG_COLOR);
  // Bottom-right
  drawPixel(ctx, bx + bw - 2, by + bh - 1, BORDER_COLOR, borderAlpha);
  drawPixel(ctx, bx + bw - 1, by + bh - 2, BORDER_COLOR, borderAlpha);
  drawPixel(ctx, bx + bw - 2, by + bh - 2, BG_COLOR);

  // Tail — small triangle at bottom-left pointing down
  const tailX = bx + 6;
  const tailY = by + bh;
  // Row 0 (3px wide)
  drawPixel(ctx, tailX, tailY, BORDER_COLOR, borderAlpha);
  drawPixel(ctx, tailX + 1, tailY, BORDER_COLOR, borderAlpha);
  drawPixel(ctx, tailX + 2, tailY, BORDER_COLOR, borderAlpha);
  // Row 1 (2px wide)
  drawPixel(ctx, tailX, tailY + 1, BORDER_COLOR, borderAlpha);
  drawPixel(ctx, tailX + 1, tailY + 1, BORDER_COLOR, borderAlpha);
  // Row 2 (1px)
  drawPixel(ctx, tailX, tailY + 2, BORDER_COLOR, borderAlpha);
}

function drawZ(
  ctx: CanvasRenderingContext2D,
  bitmap: [number, number][],
  ox: number,
  oy: number,
  alpha = 1,
) {
  for (const [px, py] of bitmap) {
    drawPixel(ctx, ox + px, oy + py, Z_COLOR, alpha);
  }
}

export function AfkBubble() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    const CYCLE = 2000; // full animation cycle ms

    function render(time: number) {
      ctx!.clearRect(0, 0, W * SCALE, H * SCALE);
      ctx!.globalAlpha = 1;

      // Bob offset: sine wave, 2s cycle, ±2 design pixels
      const bobOffset = Math.sin((time / 2000) * Math.PI * 2) * 2;

      // Border pulse: 1s cycle between 1.0 and 0.85
      const borderAlpha =
        0.85 + 0.15 * (0.5 + 0.5 * Math.sin((time / 1000) * Math.PI * 2));

      drawBubble(ctx!, bobOffset, borderAlpha);

      // Z animation phase (2s total cycle)
      const phase = (time % CYCLE) / CYCLE; // 0..1

      // Z positions inside bubble, accounting for bob
      const by = Math.round(bobOffset);
      const zBaseY = by + 7;

      // Small Z at left
      const smallX = 6;
      // Medium Z in middle
      const medX = smallX + 5 + 3; // 14
      // Large Z at right
      const largeX = medX + 6 + 3; // 23

      if (phase < 0.25) {
        // Phase 1: only small Z
        drawZ(ctx!, Z_SMALL, smallX, zBaseY + 2);
      } else if (phase < 0.5) {
        // Phase 2: small + medium
        drawZ(ctx!, Z_SMALL, smallX, zBaseY + 2);
        drawZ(ctx!, Z_MED, medX, zBaseY + 1);
      } else if (phase < 0.75) {
        // Phase 3: all three
        drawZ(ctx!, Z_SMALL, smallX, zBaseY + 2);
        drawZ(ctx!, Z_MED, medX, zBaseY + 1);
        drawZ(ctx!, Z_LARGE, largeX, zBaseY);
      } else {
        // Phase 4: all three, large pulses
        const pulseT = (phase - 0.75) / 0.25; // 0..1 within this phase
        const largeAlpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.cos(pulseT * Math.PI * 2));
        drawZ(ctx!, Z_SMALL, smallX, zBaseY + 2);
        drawZ(ctx!, Z_MED, medX, zBaseY + 1);
        drawZ(ctx!, Z_LARGE, largeX, zBaseY, largeAlpha);
      }

      ctx!.globalAlpha = 1;
      rafId = requestAnimationFrame(render);
    }

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W * SCALE}
      height={H * SCALE}
      style={{ width: W * SCALE, height: H * SCALE, imageRendering: "pixelated" }}
    />
  );
}
