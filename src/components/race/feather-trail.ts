/**
 * Feather particle trail — spec § 3.1. Emitted behind the local player
 * bird at an interval derived from current WPM. Single shared canvas
 * layer, 20-particle cap across all birds (oldest recycled). Positions
 * are drawn relative to the bird's rendered x, not its latest progress
 * sample (visually detached from server-latest state).
 *
 * Rendered as tiny pixel-art primitives rather than sprite image loads
 * so this module is self-contained. Feathers fade out over their
 * lifetime and drift downward with a small gravity term.
 */

const MAX_PARTICLES = 20;
const GRAVITY_PER_FRAME = 0.03;
const DRIFT_DAMPING = 0.99;

interface Feather {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  lifeMs: number;
  hue: number; // 0..1 → mapped to a few warm colors for variety
}

export class FeatherTrail {
  private particles: Feather[] = [];
  private lastEmitMs = 0;

  /** Emission interval in ms for a given WPM (spec § 3.1 formula). */
  static emissionIntervalMs(wpm: number): number {
    const n = Math.max(wpm / 20, 0.01);
    return Math.min(1200, Math.max(80, 1000 / n));
  }

  /** Emit a feather at (x, y). Caller rate-limits via emissionIntervalMs. */
  emit(x: number, y: number): void {
    if (this.particles.length >= MAX_PARTICLES) {
      this.particles.shift(); // oldest recycled
    }
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -0.1 - Math.random() * 0.2,
      ageMs: 0,
      lifeMs: 800 + Math.random() * 400,
      hue: Math.random(),
    });
  }

  /** Rate-gated emission wrapper — returns true if a new particle was emitted. */
  tryEmit(x: number, y: number, wpm: number, nowMs: number): boolean {
    const interval = FeatherTrail.emissionIntervalMs(wpm);
    if (nowMs - this.lastEmitMs < interval) return false;
    this.lastEmitMs = nowMs;
    this.emit(x, y);
    return true;
  }

  update(deltaMs: number): void {
    const k = deltaMs / 16.67;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.ageMs += deltaMs;
      if (p.ageMs >= p.lifeMs) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.vy += GRAVITY_PER_FRAME * k;
      p.vx *= DRIFT_DAMPING;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Tiny pixel-art feather: 2px core + 2-pixel highlight, fading.
    for (const p of this.particles) {
      const t = p.ageMs / p.lifeMs;
      const alpha = Math.max(0, 1 - t);
      // Warm earthy palette
      const color =
        p.hue < 0.33 ? "#d4a76a" :
        p.hue < 0.66 ? "#a67c52" :
        "#c89b7b";
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 2);
      ctx.fillRect(Math.round(p.x) + 1, Math.round(p.y) - 1, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  reset(): void {
    this.particles.length = 0;
    this.lastEmitMs = 0;
  }
}
