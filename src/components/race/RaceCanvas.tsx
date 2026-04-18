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
import {
  computeInterpolatedCharIndex,
  type Sample,
} from "@/hooks/useInterpolatedProgress";

/** How long with no new sample before we treat a ghost as transiently frozen. */
const FREEZE_HEURISTIC_MS = 150;

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
  backgroundSeed?: number;
  /**
   * Per-opponent sample buffer, keyed by userId.
   * Populated by useMultiplayerRace (Task 12).  Passing null/undefined falls
   * back to the legacy _liveProgress path so existing behaviour is preserved
   * until P2-12 is wired.
   */
  samplesRef?: React.RefObject<Map<string, Sample[]>>;
  /**
   * Returns true once the clock-sync has at least 5 handshake samples.
   * Used to choose steady-state (200 ms) vs warmup (350 ms) render lag.
   * TODO(P2-12): wire from useMultiplayerRace / ClockSync.
   */
  clockSyncIsReady?: () => boolean;
  /**
   * Converts a client-local performance.now() timestamp to adjusted server
   * time.  Used by the interpolation render to pick the right render point.
   * TODO(P2-12): wire from ClockSync.toServerTime.
   */
  toServerTime?: (clientMs: number) => number;
  /**
   * isConnected state per opponent userId.
   * Drives the disconnect "..." bubble per spec § 2.2.1.
   * TODO(P2-12): populated from useMultiplayerRace players array.
   */
  ghostConnectedStates?: Map<string, boolean>;
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
  backgroundSeed,
  samplesRef,
  clockSyncIsReady,
  toServerTime,
  ghostConnectedStates,
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
        if (backgroundSeed !== undefined) {
          parallaxRef.current.setSeed(backgroundSeed);
        }

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
            isDisconnected: false,
            isFrozen: false,
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
            isDisconnected: false,
            isFrozen: false,
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
  }, [playerBird, playerUsername, ghosts.length]);

  // Store latest values in refs for the animation loop
  const phaseRef = useRef(phase);
  const countdownValueRef = useRef(countdownValue);
  const playerProgressRef = useRef(playerProgress);
  const ghostsDataRef = useRef(ghosts);
  const totalCharsRef = useRef(totalChars);
  const raceStartTimeRef = useRef(raceStartTime);

  // Refs for optional interpolation props — kept in refs so the animation
  // loop (which closes over them once at mount) always reads the latest value.
  const clockSyncIsReadyRef = useRef(clockSyncIsReady);
  const toServerTimeRef = useRef(toServerTime);
  const ghostConnectedStatesRef = useRef(ghostConnectedStates);

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
  useEffect(() => { clockSyncIsReadyRef.current = clockSyncIsReady; }, [clockSyncIsReady]);
  useEffect(() => { toServerTimeRef.current = toServerTime; }, [toServerTime]);
  useEffect(() => { ghostConnectedStatesRef.current = ghostConnectedStates; }, [ghostConnectedStates]);

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
        const now = performance.now();

        // Steady-state render lag: 200 ms, warmup: 350 ms (until clock-sync has
        // 5 samples). TODO(P2-12): clockSyncIsReady and toServerTime are wired
        // here and will be non-null once useMultiplayerRace populates them.
        const isReady = clockSyncIsReadyRef.current?.() ?? false;
        const RENDER_LAG_MS = isReady ? 200 : 350;

        for (let i = 1; i < racers.length; i++) {
          const ghost = ghostsDataRef.current[i - 1];
          const racer = racers[i];
          if (!ghost) continue;

          const userId = ghost.id;

          // --- Determine ghost progress via interpolation or legacy fallback ---
          const samples = samplesRef?.current?.get(userId);
          let ghostProgress: number;

          if (samples && samples.length > 0) {
            // Convert client wall-clock to adjusted server time, apply render lag.
            const serverNow = toServerTimeRef.current
              ? toServerTimeRef.current(now)
              : now; // identity until P2-12 wires ClockSync
            const renderTime = serverNow - RENDER_LAG_MS;
            const charIndex = computeInterpolatedCharIndex(samples, renderTime);
            ghostProgress = totalCharsRef.current > 0
              ? charIndex / totalCharsRef.current
              : 0;

            // § 2.2.1 freeze heuristic: if renderTime is more than
            // FREEZE_HEURISTIC_MS past the newest sample's serverTime, the
            // buffer has run dry — treat as a transient freeze.
            // This is self-contained: no external wall-clock stamp needed.
            const lastSampleServerTime = samples[samples.length - 1].serverTime;
            racer.isFrozen = renderTime - lastSampleServerTime > FREEZE_HEURISTIC_MS;
          } else {
            // Legacy path: read raw _liveProgress from the ghost payload
            // (used for solo ghost replay and until P2-12 fills the buffer).
            const liveProgress = (ghost as GhostRacer & { _liveProgress?: number })._liveProgress;
            ghostProgress = liveProgress !== undefined
              ? liveProgress
              : interpolateGhostProgress(
                  ghost.clientGhostData,
                  elapsed,
                  totalCharsRef.current
                );
            racer.isFrozen = false;
          }

          // § 2.2.1: disconnected flag — read from ghostConnectedStates prop.
          // TODO(P2-12): ghostConnectedStates is populated from
          // useMultiplayerRace's players array.
          const isConnected = ghostConnectedStatesRef.current?.get(userId) ?? true;
          racer.isDisconnected = !isConnected;

          updateRacerPosition(racer, ghostProgress, deltaMs);
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
