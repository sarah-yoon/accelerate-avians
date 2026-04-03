"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface BirdDef {
  id: string;
  name: string;
  species: string;
  tab: "flock" | "units";
}

const FLOCK: BirdDef[] = [
  { id: "cardinal", name: "RED", species: "Cardinal", tab: "flock" },
  { id: "owl", name: "OLLIE", species: "Owl", tab: "flock" },
  { id: "puffin", name: "FINN", species: "Puffin", tab: "flock" },
  { id: "peacock", name: "DUCHESS", species: "Peacock", tab: "flock" },
  { id: "falcon", name: "ACE", species: "Falcon", tab: "flock" },
  { id: "toucan", name: "BERRY", species: "Toucan", tab: "flock" },
  { id: "snowy-owl", name: "GHOST", species: "Snowy Owl", tab: "flock" },
  { id: "bluejay", name: "BOLT", species: "Blue Jay", tab: "flock" },
];

const UNITS: BirdDef[] = [
  { id: "sparq", name: "SPARQ", species: "Scout", tab: "units" },
  { id: "tank", name: "TANK", species: "Heavy", tab: "units" },
  { id: "glitch", name: "GLITCH", species: "Damaged", tab: "units" },
  { id: "nova", name: "NOVA", species: "Stealth", tab: "units" },
  { id: "sunny", name: "SUNNY", species: "Companion", tab: "units" },
  { id: "rex", name: "REX", species: "Ancient", tab: "units" },
  { id: "prism", name: "PRISM", species: "Experimental", tab: "units" },
  { id: "king", name: "KING", species: "Commander", tab: "units" },
];

const ALL_BIRDS = [...FLOCK, ...UNITS];

interface BirdSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
}

export function BirdSelector({ selected, onSelect }: BirdSelectorProps) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const animFrameRef = useRef<number>(0);

  const birds = FLOCK;
  const selectedBird = ALL_BIRDS.find((b) => b.id === selected) ?? FLOCK[0];

  // Load all sprite images
  useEffect(() => {
    let loaded = 0;
    const total = ALL_BIRDS.length;
    for (const bird of ALL_BIRDS) {
      const img = new Image();
      img.onload = () => {
        imagesRef.current.set(bird.id, img);
        loaded++;
        if (loaded === total) setImagesLoaded(true);
      };
      img.src = `/sprites/${bird.id}.png`;
    }
  }, []);

  // Preview animation loop
  const drawPreview = useCallback(() => {
    const canvas = previewRef.current;
    if (!canvas || !imagesLoaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = imagesRef.current.get(selected);
    if (!img) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 256, 256);

    // Background
    ctx.fillStyle = "#1A1A2E";
    ctx.fillRect(0, 0, 256, 256);

    const now = performance.now();
    const frameSrc = img.height; // 32 or 16

    // Determine animation frame — blink every 3 seconds
    let frame = 0;
    const cycle = now % 3000;
    if (cycle > 2800) {
      frame = 1;
    } else {
      const wingCycle = Math.floor(now / 200) % 4;
      frame = [0, 2, 0, 3][wingCycle] ?? 0;
      if (frame === 3) frame = 0;
    }

    const srcX = frame * frameSrc;
    ctx.drawImage(img, srcX, 0, frameSrc, frameSrc, 28, 28, 200, 200);

    animFrameRef.current = requestAnimationFrame(drawPreview);
  }, [selected, selectedBird, imagesLoaded]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(drawPreview);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawPreview]);

  function randomize() {
    const pick = FLOCK[Math.floor(Math.random() * FLOCK.length)];
    onSelect(pick.id);
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
      {/* Left: grid */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex gap-2 mb-4 items-center">
          <span className="font-heading text-[7px] text-pixel-text-dim tracking-wider">THE FLOCK</span>
          <button
            onClick={randomize}
            className="font-heading text-[7px] px-3 py-2 pixel-select ml-auto"
            title="Random bird"
          >
            ?
          </button>
        </div>

        {/* Grid 4x2 */}
        <div className="grid grid-cols-4 gap-2">
          {birds.map((bird) => {
            const isSelected = selected === bird.id;
            return (
              <button
                key={bird.id}
                onClick={() => onSelect(bird.id)}
                className={`flex flex-col items-center p-2 transition-all ${
                  isSelected ? "pixel-panel-gold" : "pixel-panel hover:border-pixel-text-white"
                }`}
              >
                {imagesLoaded && imagesRef.current.has(bird.id) ? (
                  <BirdGridIcon
                    img={imagesRef.current.get(bird.id)!}
                    size={48}
                  />
                ) : (
                  <div className="w-12 h-12 bg-pixel-navy" />
                )}
                <span
                  className={`font-heading text-[5px] mt-1 ${
                    isSelected ? "text-pixel-bird-yellow" : "text-pixel-text-dim"
                  }`}
                >
                  {bird.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: preview */}
      <div className="flex flex-col items-center">
        <canvas
          ref={previewRef}
          width={256}
          height={256}
          className="border-4 border-pixel-text-dim"
          style={{ imageRendering: "pixelated", width: 200, height: 200 }}
        />
        <h3 className="font-heading text-pixel-bird-yellow text-[10px] mt-3 text-glow-yellow">
          {selectedBird.name}
        </h3>
        <p className="font-heading text-pixel-text-dim text-[7px] mt-1">
          {selectedBird.tab === "flock" ? selectedBird.species : `${selectedBird.species} Unit`}
        </p>
      </div>
    </div>
  );
}

// Small grid icon — draws frame 0 of a sprite
function BirdGridIcon({ img, size }: { img: HTMLImageElement; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    const frameSrc = img.height;
    ctx.drawImage(img, 0, 0, frameSrc, frameSrc, 0, 0, size, size);
  }, [img, size]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ imageRendering: "pixelated", width: size, height: size }}
    />
  );
}

export { ALL_BIRDS, FLOCK, UNITS };
export type { BirdDef };
