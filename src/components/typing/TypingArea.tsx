"use client";

import { useEffect, useRef } from "react";

interface TypingAreaProps {
  passage: string;
  cursorPos: number;
  hasError: boolean;
  wpm: number;
  accuracy: number;
  elapsedMs: number;
  enabled: boolean;
  onKeyDown: (e: KeyboardEvent) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
}

export function TypingArea({
  passage,
  cursorPos,
  hasError,
  wpm,
  accuracy,
  elapsedMs,
  enabled,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
}: TypingAreaProps) {
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;
  const timeDisplay = `${minutes}:${String(seconds).padStart(2, "0")}`;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (enabled) onKeyDown(e);
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("compositionstart", onCompositionStart);
    window.addEventListener("compositionend", onCompositionEnd);

    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("compositionstart", onCompositionStart);
      window.removeEventListener("compositionend", onCompositionEnd);
    };
  }, [enabled, onKeyDown, onCompositionStart, onCompositionEnd]);

  // Auto-scroll to keep cursor visible
  useEffect(() => {
    if (containerRef.current) {
      const cursorEl = containerRef.current.querySelector("[data-cursor]");
      if (cursorEl) {
        cursorEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [cursorPos]);

  return (
    <div className="bg-pixel-panel border-2 border-pixel-text-dim p-4">
      {/* Stats bar */}
      <div className="flex justify-between font-heading text-[10px] mb-3">
        <span className="text-pixel-bird-yellow">
          WPM: {wpm}
        </span>
        <span className="text-pixel-text-white">
          ACC: {Math.round(accuracy * 100)}%
        </span>
        <span className="text-pixel-text-dim">
          {timeDisplay}
        </span>
      </div>

      {/* Passage text — shown as full paragraph, scrolls down as you type */}
      <div
        ref={containerRef}
        className="text-base leading-relaxed max-h-40 overflow-y-auto font-bold"
        style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
      >
        <span className="text-pixel-text-green">
          {passage.slice(0, cursorPos)}
        </span>
        {cursorPos < passage.length && (
          <>
            <span
              data-cursor="true"
              className={
                hasError
                  ? "text-pixel-bird-red bg-pixel-bird-red/20"
                  : "border-l-2 border-pixel-bird-yellow text-pixel-text-dim"
              }
            >
              {passage[cursorPos] === " " ? "\u00A0" : passage[cursorPos]}
            </span>
            <span className="text-pixel-text-dim">
              {passage.slice(cursorPos + 1)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
