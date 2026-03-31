"use client";

import { useRef, useEffect } from "react";
import {
  drawRace,
  updateRacerPosition,
  BASE_WIDTH,
  BASE_HEIGHT,
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
}: RaceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const racersRef = useRef<Racer[]>([]);
  const parallaxRef = useRef<ParallaxRenderer>(new ParallaxRenderer());
  const imagesLoadedRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  const animFrameRef = useRef<number>(0);

  // Initialize sprites and images
  useEffect(() => {
    async function loadAssets() {
      try {
        const [playerImg, ghostImg, bgFar, bgMid, bgNear] = await Promise.all([
          loadImage(`/sprites/${playerBird}.png`),
          loadImage("/sprites/ghost.png"),
          loadImage("/backgrounds/bg-far.png"),
          loadImage("/backgrounds/bg-mid.png"),
          loadImage("/backgrounds/bg-near.png"),
        ]);

        // Setup parallax
        const parallax = new ParallaxRenderer();
        parallax.addLayer(bgFar, 0.2);
        parallax.addLayer(bgMid, 0.5);
        parallax.addLayer(bgNear, 1.0);
        parallaxRef.current = parallax;

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
          ...ghosts.map((ghost) => ({
            id: ghost.id,
            username: ghost.username,
            sprite: new BirdSprite(4, 8),
            spriteImage: ghostImg,
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

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { countdownValueRef.current = countdownValue; }, [countdownValue]);
  useEffect(() => { playerProgressRef.current = playerProgress; }, [playerProgress]);
  useEffect(() => { ghostsDataRef.current = ghosts; }, [ghosts]);
  useEffect(() => { totalCharsRef.current = totalChars; }, [totalChars]);
  useEffect(() => { raceStartTimeRef.current = raceStartTime; }, [raceStartTime]);

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

      // Update player position
      if (racers[0]) {
        updateRacerPosition(racers[0], playerProgressRef.current, deltaMs);
      }

      // Update ghost positions
      if (raceStartTimeRef.current && phaseRef.current === "racing") {
        const elapsed = performance.now() - raceStartTimeRef.current;
        for (let i = 1; i < racers.length; i++) {
          const ghost = ghostsDataRef.current[i - 1];
          if (ghost) {
            const ghostProgress = interpolateGhostProgress(
              ghost.ghostData,
              elapsed,
              totalCharsRef.current
            );
            updateRacerPosition(racers[i], ghostProgress, deltaMs);
          }
        }
      }

      // Scroll parallax based on player progress delta
      const prevProgress = racers[0]?.progress ?? 0;
      parallaxRef.current.update((playerProgressRef.current - prevProgress) * BASE_WIDTH);

      const state: RaceRendererState = {
        phase: phaseRef.current,
        countdownValue: countdownValueRef.current,
        racers,
        totalChars: totalCharsRef.current,
      };

      drawRace(ctx, state, parallaxRef.current, deltaMs);

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
    <canvas
      ref={canvasRef}
      width={BASE_WIDTH}
      height={BASE_HEIGHT}
      className="w-full border-2 border-pixel-text-dim bg-pixel-sky"
      style={{
        imageRendering: "pixelated",
        maxWidth: `${BASE_WIDTH * 2}px`,
        aspectRatio: `${BASE_WIDTH}/${BASE_HEIGHT}`,
      }}
    />
  );
}
