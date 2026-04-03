"use client";

import { useRef, useEffect } from "react";

interface WpmChartProps {
  races: { wpm: number; createdAt: string }[];
}

export function WpmChart({ races }: WpmChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || races.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const pad = { top: 20, right: 10, bottom: 25, left: 35 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    // Data — oldest first
    const data = [...races].reverse();
    const wpms = data.map((r) => r.wpm);
    const minWpm = Math.max(0, Math.min(...wpms) - 10);
    const maxWpm = Math.max(...wpms) + 10;
    const range = maxWpm - minWpm || 1;

    // Background
    ctx.fillStyle = "#0A0A14";
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "#1A1A2E";
    ctx.lineWidth = 1;
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const y = pad.top + (plotH / gridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      // Y-axis labels
      const val = Math.round(maxWpm - (range / gridSteps) * i);
      ctx.fillStyle = "#5A5A7A";
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = "right";
      ctx.fillText(String(val), pad.left - 4, y + 3);
    }

    // Plot line
    ctx.beginPath();
    ctx.strokeStyle = "#66BB6A";
    ctx.lineWidth = 2;
    for (let i = 0; i < data.length; i++) {
      const x = pad.left + (i / (data.length - 1)) * plotW;
      const y = pad.top + (1 - (data[i].wpm - minWpm) / range) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Plot dots
    for (let i = 0; i < data.length; i++) {
      const x = pad.left + (i / (data.length - 1)) * plotW;
      const y = pad.top + (1 - (data[i].wpm - minWpm) / range) * plotH;
      ctx.fillStyle = "#66BB6A";
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
    }

    // X-axis label
    ctx.fillStyle = "#5A5A7A";
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText("RECENT RACES", w / 2, h - 3);
  }, [races]);

  if (races.length < 2) return null;

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={160}
      className="w-full mb-6"
      style={{ maxWidth: 500, imageRendering: "auto" }}
    />
  );
}
