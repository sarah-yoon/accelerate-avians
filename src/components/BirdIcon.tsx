"use client";

import { useRef, useEffect } from "react";

interface BirdIconProps {
  src: string;
  size: number;
  className?: string;
}

export function BirdIcon({ src, size, className = "" }: BirdIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, size, size);
      const frameSrc = img.height;
      ctx.drawImage(img, 0, 0, frameSrc, frameSrc, 0, 0, size, size);
    };
    img.src = src;
  }, [src, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: "pixelated", width: size, height: size }}
    />
  );
}
