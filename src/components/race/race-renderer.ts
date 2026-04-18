import { BirdSprite } from "./bird-sprite";
import { ParallaxRenderer } from "./parallax";
import { drawCountdown } from "./countdown-overlay";
import type { GhostDataPoint, RacePhase } from "@/types";

const BASE_WIDTH = 480;
const BASE_HEIGHT = 240;
const SPRITE_SRC = 16;   // source sprite size
const SPRITE_SIZE = 28;  // rendered size
const MAX_LANES = 6;
const MINIMAP_HEIGHT = 0; // minimap is now rendered outside the canvas

// How many "screens" wide the virtual track is — higher = racers spread out more and leave screen faster
const TRACK_SCALE = 5;

export interface Racer {
  id: string;
  username: string;
  sprite: BirdSprite;
  spriteImage: HTMLImageElement;
  progress: number; // 0 to 1
  renderedX: number; // lerped screen position
  isGhost: boolean;
  isPlayer: boolean;
  /**
   * True when the opponent's socket has disconnected (server broadcast
   * `player_disconnected`).  Shows the "..." bubble above the bird.
   * § 2.2.1 of the netcode spec.
   */
  isDisconnected: boolean;
  /**
   * True when interpolation has frozen due to sample underflow (no new
   * samples for > 150 ms) but `isDisconnected` is still false.  Drops
   * flap rate to idle 4 fps and pauses feather emission without the bubble.
   * § 2.2.1 of the netcode spec.
   */
  isFrozen: boolean;
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

  let low = 0;
  let high = ghostData.length - 1;

  if (elapsedMs <= ghostData[0].ms) return 0;
  if (elapsedMs >= ghostData[high].ms) {
    return ghostData[high].charIndex / totalChars;
  }

  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    if (ghostData[mid].ms <= elapsedMs) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const p0 = ghostData[low];
  const p1 = ghostData[high];
  const t = (elapsedMs - p0.ms) / (p1.ms - p0.ms);
  const charIndex = p0.charIndex + (p1.charIndex - p0.charIndex) * t;

  return charIndex / totalChars;
}

// ==================== PARTICLE SYSTEM ====================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

const CONFETTI_COLORS = ["#FFD700", "#66BB6A", "#E74C3C", "#3498DB", "#FF8C00", "#E8E8E8"];

export class ParticleSystem {
  private particles: Particle[] = [];

  burst(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5, // upward bias
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 4 + Math.floor(Math.random() * 5),
        life: 0,
        maxLife: 800 + Math.random() * 600,
      });
    }
  }

  update(deltaMs: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += deltaMs;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * (deltaMs / 16.67);
      p.y += p.vy * (deltaMs / 16.67);
      p.vy += 0.06 * (deltaMs / 16.67); // gravity
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  get active() {
    return this.particles.length > 0;
  }

  reset() {
    this.particles = [];
  }
}

export function drawRace(
  ctx: CanvasRenderingContext2D,
  state: RaceRendererState,
  parallax: ParallaxRenderer,
  deltaMs: number,
  particles?: ParticleSystem
): void {
  const { phase, racers } = state;

  // Crisp pixel scaling — no blur on upscale
  ctx.imageSmoothingEnabled = false;

  // Clear
  ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

  // Draw parallax background
  parallax.draw(ctx, BASE_WIDTH, BASE_HEIGHT);

  // Find player for camera
  const player = racers.find((r) => r.isPlayer);
  const playerProgress = player?.progress ?? 0;

  // Camera: player is always at ~30% of the screen width
  const playerScreenX = BASE_WIDTH * 0.3;
  const playerWorldX = playerProgress * BASE_WIDTH * TRACK_SCALE;
  const cameraX = playerWorldX - playerScreenX;

  // Draw lanes
  const laneCount = Math.min(racers.length, MAX_LANES);
  const raceAreaTop = 0;
  const raceAreaHeight = BASE_HEIGHT;
  const laneHeight = Math.floor(raceAreaHeight / Math.max(laneCount, 1));

  for (let i = 0; i < laneCount; i++) {
    const laneY = raceAreaTop + i * laneHeight;

    // Lane separator
    if (i > 0) {
      ctx.strokeStyle = "#2A2A3E";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, laneY);
      ctx.lineTo(BASE_WIDTH, laneY);
      ctx.stroke();
    }

    // Draw checkered finish line (at end of virtual track, relative to camera)
    const finishWorldX = BASE_WIDTH * TRACK_SCALE;
    const finishScreenX = finishWorldX - cameraX;
    const checkerWidth = 16;
    const checkerSize = 6;
    if (finishScreenX > -checkerWidth && finishScreenX < BASE_WIDTH + checkerWidth) {
      for (let row = 0; row < Math.ceil(laneHeight / checkerSize); row++) {
        for (let col = 0; col < Math.ceil(checkerWidth / checkerSize); col++) {
          const isLight = (row + col) % 2 === 0;
          ctx.fillStyle = isLight ? "#c8b8d0" : "#3d2a4a";
          ctx.fillRect(
            Math.round(finishScreenX - checkerWidth / 2 + col * checkerSize),
            laneY + row * checkerSize,
            checkerSize,
            checkerSize
          );
        }
      }
    }
  }

  // Draw racers relative to camera
  for (let i = 0; i < laneCount; i++) {
    const racer = racers[i];
    const laneY = raceAreaTop + i * laneHeight;
    const birdY = laneY + Math.floor((laneHeight - SPRITE_SIZE) / 2);

    // World position of this racer
    const racerWorldX = racer.progress * BASE_WIDTH * TRACK_SCALE;
    const screenX = racerWorldX - cameraX;

    // § 2.2.1 — freeze pose: idle flap rate for disconnected / frozen ghosts.
    // TODO(P2-12): feather emission pause will also be gated here once Phase 5
    // adds feather trails; add `if (!racer.isFrozen && !racer.isDisconnected)`
    // guard around the emitter call.
    if (!racer.isPlayer && (racer.isDisconnected || racer.isFrozen)) {
      racer.sprite.setFps(4); // idle rate per spec § 2.2.1
    } else if (!racer.isPlayer) {
      // TODO(Phase 5 § 3.1): derive flapFps from opponent currentWPM:
      //   flapFps = clamp(currentWPM / 10, 4, 12)
      // For now, fixed 8 fps keeps birds visibly animated during Phase 2.
      racer.sprite.setFps(8);
    }

    // Skip drawing if off-screen (but still update sprite)
    racer.sprite.update(deltaMs);

    if (screenX < -SPRITE_SIZE || screenX > BASE_WIDTH + SPRITE_SIZE) {
      continue; // off-screen — don't draw
    }

    // Draw bird sprite — detect source frame size from image height
    const frameSrc = racer.spriteImage.height;
    const srcX = racer.sprite.getSourceX(frameSrc);
    const destX = Math.round(screenX);
    const destY = Math.round(birdY);

    ctx.drawImage(
      racer.spriteImage,
      srcX, 0, frameSrc, frameSrc,
      destX, destY, SPRITE_SIZE, SPRITE_SIZE
    );

    // § 2.2.1 — "..." bubble: only for disconnected opponents, NOT transient freeze.
    if (!racer.isPlayer && racer.isDisconnected) {
      ctx.font = '5px "Press Start 2P", monospace';
      const bubbleText = "...";
      const bubbleW = ctx.measureText(bubbleText).width + 4;
      const bubbleH = 10;
      const bubbleX = destX + (SPRITE_SIZE - bubbleW) / 2;
      const bubbleY = Math.round(birdY - 14);
      ctx.fillStyle = "rgba(10, 10, 20, 0.75)";
      ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
      ctx.fillStyle = "#C0C0D0";
      ctx.textAlign = "left";
      ctx.fillText(bubbleText, bubbleX + 2, bubbleY + bubbleH - 2);
    }

    // Draw username label (above bird) with background for readability
    ctx.font = '5px "Press Start 2P", monospace';
    const textWidth = ctx.measureText(racer.username).width;
    const labelX = destX + (SPRITE_SIZE - textWidth) / 2;
    const labelY = Math.round(birdY - 4);
    ctx.fillStyle = "rgba(10, 10, 20, 0.55)";
    ctx.fillRect(labelX - 2, labelY - 7, textWidth + 4, 10);
    ctx.textAlign = "left";
    ctx.fillStyle = racer.isPlayer ? "#FFD700" : "#C0C0D0";
    ctx.fillText(racer.username, labelX, labelY);
  }

  // Draw particles (confetti on finish)
  if (particles) {
    particles.update(deltaMs);
    particles.draw(ctx);
  }

  // Draw countdown overlay if applicable
  if (phase === "countdown") {
    drawCountdown(ctx, BASE_WIDTH, BASE_HEIGHT, state.countdownValue);
  }
}

export { BASE_WIDTH, BASE_HEIGHT };
