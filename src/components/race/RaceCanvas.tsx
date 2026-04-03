"use client";

import { useRef, useEffect } from "react";
import {
  drawRace,
  updateRacerPosition,
  BASE_WIDTH,
  BASE_HEIGHT,
  ParticleSystem,
} from "./race-renderer";
import { ParallaxRenderer } from "./parallax";
import { BirdSprite } from "./bird-sprite";
import type { RacePhase, GhostRacer } from "@/types";
import type { Racer, RaceRendererState } from "./race-renderer";
import { interpolateGhostProgress } from "./race-renderer";

interface RaceCanvasProps {
  phase: RacePhase;
  countdownValue: number | "GO";
  playerProgress: number;
  playerBird: string;
  playerUsername: string;
  ghosts: GhostRacer[];
  totalChars: number;
  raceStartTime: number | null;
  wpm: number;
}

const MINIMAP_ICON = 24;

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  racers: Racer[],
  w: number,
  h: number
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);

  const padX = 8;
  const trackW = w - padX * 2;
  const trackY = Math.floor(h / 2);

  // Track line
  ctx.fillStyle = "#2A2A3E";
  ctx.fillRect(padX, trackY - 1, trackW, 3);

  // Start & finish markers
  ctx.fillStyle = "#5A5A7A";
  ctx.fillRect(padX, trackY - 5, 2, 11);
  ctx.fillRect(padX + trackW - 2, trackY - 5, 2, 11);

  // Checkered finish flag on minimap
  const flagX = padX + trackW - 8;
  const flagSize = 3;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? "#c8b8d0" : "#3d2a4a";
      ctx.fillRect(flagX + col * flagSize, trackY - 6 + row * flagSize, flagSize, flagSize);
    }
  }

  // Draw ghosts first, player last (on top)
  const sorted = [...racers].sort((a, b) => {
    if (a.isPlayer) return 1;
    if (b.isPlayer) return -1;
    return 0;
  });

  for (const racer of sorted) {
    const iconX = padX + racer.progress * (trackW - MINIMAP_ICON);
    const iconY = trackY - MINIMAP_ICON / 2;

    const frameSrc = racer.spriteImage.height;
    ctx.drawImage(
      racer.spriteImage,
      0, 0, frameSrc, frameSrc,
      Math.round(iconX), Math.round(iconY),
      MINIMAP_ICON, MINIMAP_ICON
    );

    if (racer.isPlayer) {
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.round(iconX) - 1,
        Math.round(iconY) - 1,
        MINIMAP_ICON + 2,
        MINIMAP_ICON + 2
      );
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function RaceCanvas({
  phase,
  countdownValue,
  playerProgress,
  playerBird,
  playerUsername,
  ghosts,
  totalChars,
  raceStartTime,
  wpm,
}: RaceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const racersRef = useRef<Racer[]>([]);
  const particlesRef = useRef<ParticleSystem>(new ParticleSystem());
  const parallaxRef = useRef<ParallaxRenderer>(new ParallaxRenderer());
  const imagesLoadedRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const scrollVelocityRef = useRef(0);
  const lastTypingTimeRef = useRef(0);

  // Initialize sprites and images
  useEffect(() => {
    async function loadAssets() {
      try {
        // Load player sprite
        const playerImg = await loadImage(`/sprites/${playerBird}.png`);

        // Load each ghost's sprite — bots use robot sprite
        const ghostImgs = await Promise.all(
          ghosts.map((ghost) => {
            const sprite = ghost.username.startsWith("Bot") || ghost.username.startsWith("bot")
              ? "robot"
              : ghost.displayBird;
            return loadImage(`/sprites/${sprite}.png`);
          })
        );

        // Parallax is now procedurally generated — just reset it
        parallaxRef.current = new ParallaxRenderer();

        // Setup racers
        const racers: Racer[] = [
          {
            id: "player",
            username: playerUsername,
            sprite: new BirdSprite(4, 8),
            spriteImage: playerImg,
            progress: 0,
            renderedX: 8,
            isGhost: false,
            isPlayer: true,
          },
          ...ghosts.map((ghost, i) => ({
            id: ghost.id,
            username: ghost.username,
            sprite: new BirdSprite(4, 8),
            spriteImage: ghostImgs[i],
            progress: 0,
            renderedX: 8,
            isGhost: true,
            isPlayer: false,
          })),
        ];

        racersRef.current = racers;
        imagesLoadedRef.current = true;
      } catch {
        // If images fail to load, use colored rectangles as fallback
        console.warn("Failed to load sprite images, using fallback rendering.");
        imagesLoadedRef.current = true;
      }
    }

    loadAssets();
  }, [playerBird, playerUsername, ghosts]);

  // Store latest values in refs for the animation loop
  const phaseRef = useRef(phase);
  const countdownValueRef = useRef(countdownValue);
  const playerProgressRef = useRef(playerProgress);
  const ghostsDataRef = useRef(ghosts);
  const totalCharsRef = useRef(totalChars);
  const raceStartTimeRef = useRef(raceStartTime);

  useEffect(() => {
    // Trigger confetti when race finishes
    if (phase === "finished" && phaseRef.current !== "finished") {
      // Burst confetti across the whole screen
      for (let i = 0; i < 5; i++) {
        const x = Math.random() * BASE_WIDTH;
        const y = Math.random() * BASE_HEIGHT * 0.5;
        particlesRef.current.burst(x, y, 15);
      }
    }
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => { countdownValueRef.current = countdownValue; }, [countdownValue]);
  useEffect(() => { playerProgressRef.current = playerProgress; }, [playerProgress]);
  useEffect(() => { ghostsDataRef.current = ghosts; }, [ghosts]);
  useEffect(() => { totalCharsRef.current = totalChars; }, [totalChars]);
  const wpmRef = useRef(wpm);
  useEffect(() => { raceStartTimeRef.current = raceStartTime; }, [raceStartTime]);
  useEffect(() => { wpmRef.current = wpm; }, [wpm]);

  // Animation loop using refs to avoid stale closures and self-reference issues
  useEffect(() => {
    function animate(timestamp: number) {
      const canvas = canvasRef.current;
      if (!canvas || !imagesLoadedRef.current) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const deltaMs = lastFrameTimeRef.current
        ? timestamp - lastFrameTimeRef.current
        : 16.67;
      lastFrameTimeRef.current = timestamp;

      const racers = racersRef.current;

      // Capture progress before updating so we can compute the delta
      const prevProgress = racers[0]?.progress ?? 0;

      // Update player position
      if (racers[0]) {
        updateRacerPosition(racers[0], playerProgressRef.current, deltaMs);
      }

      // Update ghost positions — keep running even after player finishes
      if (raceStartTimeRef.current && (phaseRef.current === "racing" || phaseRef.current === "finished")) {
        const elapsed = performance.now() - raceStartTimeRef.current;
        for (let i = 1; i < racers.length; i++) {
          const ghost = ghostsDataRef.current[i - 1];
          if (ghost) {
            // Support live progress from multiplayer socket events
            const liveProgress = (ghost as GhostRacer & { _liveProgress?: number })._liveProgress;
            const ghostProgress = liveProgress !== undefined
              ? liveProgress
              : interpolateGhostProgress(
                  ghost.ghostData,
                  elapsed,
                  totalCharsRef.current
                );
            updateRacerPosition(racers[i], ghostProgress, deltaMs);
          }
        }
      }

      // Momentum-based parallax scrolling:
      // Typing adds velocity, friction slows it down when idle
      const progressDelta = playerProgressRef.current - prevProgress;
      const FRICTION = 0.985;
      const TYPING_BOOST = 6000;
      const MAX_VELOCITY = 3;

      if (progressDelta > 0) {
        scrollVelocityRef.current += progressDelta * TYPING_BOOST * (deltaMs / 16.67);
      }

      scrollVelocityRef.current *= FRICTION;
      scrollVelocityRef.current = Math.min(scrollVelocityRef.current, MAX_VELOCITY);

      if (scrollVelocityRef.current < 0.01) {
        scrollVelocityRef.current = 0;
      }

      parallaxRef.current.update(scrollVelocityRef.current);

      const state: RaceRendererState = {
        phase: phaseRef.current,
        countdownValue: countdownValueRef.current,
        racers,
        totalChars: totalCharsRef.current,
      };

      drawRace(ctx, state, parallaxRef.current, deltaMs, particlesRef.current);

      // Draw minimap on separate canvas
      const minimap = minimapRef.current;
      if (minimap && (phaseRef.current === "racing" || phaseRef.current === "countdown" || phaseRef.current === "finished")) {
        const mCtx = minimap.getContext("2d");
        if (mCtx) {
          drawMinimap(mCtx, racers, minimap.width, minimap.height);
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <div style={{ maxWidth: `${BASE_WIDTH * 2}px` }} className="w-full">
      {/* Progress minimap above the race */}
      <canvas
        ref={minimapRef}
        width={BASE_WIDTH}
        height={40}
        className="w-full mb-1"
        style={{
          imageRendering: "pixelated",
          aspectRatio: `${BASE_WIDTH}/40`,
          backgroundColor: "#0A0A14",
        }}
      />
      {/* Main race canvas */}
      <canvas
        ref={canvasRef}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        className="w-full border-2 border-pixel-text-dim"
        style={{
          imageRendering: "pixelated",
          aspectRatio: `${BASE_WIDTH}/${BASE_HEIGHT}`,
          backgroundColor: "#1a0a2e",
        }}
      />
    </div>
  );
}
