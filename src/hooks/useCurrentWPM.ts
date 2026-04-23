"use client";
import { useEffect, useRef, useState } from "react";

export interface KeystrokeSample {
  ms: number;
}

const WINDOW_MS = 3000;
const CHARS_PER_WORD = 5;

/** Pure function: rolling WPM from keystroke timestamps within the window. */
export function computeWpm(
  samples: KeystrokeSample[],
  nowMs: number,
  windowMs = WINDOW_MS
): number {
  const cutoff = nowMs - windowMs;
  let count = 0;
  for (const s of samples) {
    if (s.ms >= cutoff && s.ms <= nowMs) count++;
  }
  if (count === 0) return 0;
  const words = count / CHARS_PER_WORD;
  return Math.round((words / windowMs) * 60_000);
}

/**
 * React hook wrapping computeWpm. Reads from a ref so the caller can append
 * keystrokes without triggering re-renders of the consumer. Updates state on
 * every RAF so dependents (flap fps, HUD) get near-frame-rate resolution.
 */
export function useCurrentWPM(
  samplesRef: React.RefObject<KeystrokeSample[]>
): number {
  const [wpm, setWpm] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      const samples = samplesRef.current ?? [];
      setWpm(computeWpm(samples, now));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [samplesRef]);

  return wpm;
}
