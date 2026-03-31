import { BirdSprite } from "./bird-sprite";
import { ParallaxRenderer } from "./parallax";
import { drawCountdown } from "./countdown-overlay";
import type { GhostDataPoint, RacePhase } from "@/types";

const BASE_WIDTH = 480;
const BASE_HEIGHT = 200;
const SPRITE_SIZE = 32;
const MAX_LANES = 6;

export interface Racer {
  id: string;
  username: string;
  sprite: BirdSprite;
  spriteImage: HTMLImageElement;
  progress: number; // 0 to 1
  renderedX: number; // lerped screen position
  isGhost: boolean;
  isPlayer: boolean;
}

export interface RaceRendererState {
  phase: RacePhase;
  countdownValue: number | "GO";
  racers: Racer[];
  totalChars: number;
}

export function updateRacerPosition(
  racer: Racer,
  targetProgress: number,
  deltaMs: number
): void {
  const targetX = targetProgress * (BASE_WIDTH - SPRITE_SIZE - 16) + 8;
  const lerpFactor = 1 - Math.pow(0.85, deltaMs / 16.67);
  racer.renderedX += (targetX - racer.renderedX) * lerpFactor;
  racer.progress = targetProgress;
}

export function interpolateGhostProgress(
  ghostData: GhostDataPoint[],
  elapsedMs: number,
  totalChars: number
): number {
  if (ghostData.length === 0 || totalChars === 0) return 0;

  // Find surrounding data points
  let low = 0;
  let high = ghostData.length - 1;

  if (elapsedMs <= ghostData[0].ms) return 0;
  if (elapsedMs >= ghostData[high].ms) {
    return ghostData[high].charIndex / totalChars;
  }

  // Binary search for surrounding points
  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    if (ghostData[mid].ms <= elapsedMs) {
      low = mid;
    } else {
      high = mid;
    }
  }

  // Linear interpolation
  const p0 = ghostData[low];
  const p1 = ghostData[high];
  const t = (elapsedMs - p0.ms) / (p1.ms - p0.ms);
  const charIndex = p0.charIndex + (p1.charIndex - p0.charIndex) * t;

  return charIndex / totalChars;
}

export function drawRace(
  ctx: CanvasRenderingContext2D,
  state: RaceRendererState,
  parallax: ParallaxRenderer,
  deltaMs: number
): void {
  const { phase, racers } = state;

  // Clear
  ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

  // Draw parallax background
  parallax.draw(ctx, BASE_WIDTH, BASE_HEIGHT);

  // Draw lanes — evenly distributed across canvas height
  const laneCount = Math.min(racers.length, MAX_LANES);
  const laneHeight = Math.floor(BASE_HEIGHT / Math.max(laneCount, 1));

  for (let i = 0; i < laneCount; i++) {
    const laneY = i * laneHeight;

    // Lane separator
    if (i > 0) {
      ctx.strokeStyle = "#2A2A3E";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, laneY);
      ctx.lineTo(BASE_WIDTH, laneY);
      ctx.stroke();
    }

    // Draw finish line
    ctx.strokeStyle = "#5A5A7A";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(BASE_WIDTH - 8, laneY);
    ctx.lineTo(BASE_WIDTH - 8, laneY + laneHeight);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw racers
  for (let i = 0; i < laneCount; i++) {
    const racer = racers[i];
    const laneY = i * laneHeight;
    const birdY = laneY + (laneHeight - SPRITE_SIZE) / 2;

    // Update sprite animation
    racer.sprite.update(deltaMs);

    // Draw bird sprite
    const srcX = racer.sprite.getSourceX(SPRITE_SIZE);
    const destX = Math.round(racer.renderedX);
    const destY = Math.round(birdY);

    ctx.drawImage(
      racer.spriteImage,
      srcX,
      0,
      SPRITE_SIZE,
      SPRITE_SIZE,
      destX,
      destY,
      SPRITE_SIZE,
      SPRITE_SIZE
    );

    // Dither pattern for ghosts: draw checkerboard mask to clear alternating pixels
    // Per spec: "not CSS opacity" — use pixel-level dithering
    if (racer.isGhost) {
      const imageData = ctx.getImageData(destX, destY, SPRITE_SIZE, SPRITE_SIZE);
      for (let py = 0; py < SPRITE_SIZE; py++) {
        for (let px = 0; px < SPRITE_SIZE; px++) {
          if ((px + py) % 2 === 1) {
            const idx = (py * SPRITE_SIZE + px) * 4;
            imageData.data[idx + 3] = 0; // Set alpha to 0 for checkerboard
          }
        }
      }
      ctx.putImageData(imageData, destX, destY);
    }

    // Draw username label (above bird)
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = racer.isPlayer ? "#FFD700" : "#5A5A7A";
    ctx.textAlign = "left";
    ctx.fillText(
      racer.username,
      Math.round(racer.renderedX),
      Math.round(birdY - 2)
    );
  }

  // Draw countdown overlay if applicable
  if (phase === "countdown") {
    drawCountdown(ctx, BASE_WIDTH, BASE_HEIGHT, state.countdownValue);
  }
}

export { BASE_WIDTH, BASE_HEIGHT };
