import { useEffect, useRef, useState } from "react";

export interface Sample {
  serverTime: number;
  charIndex: number;
}

const STEADY_DELAY_MS = 200;
const WARMUP_DELAY_MS = 350;
const EXTRAP_MS = 150;

export function computeInterpolatedCharIndex(samples: Sample[], renderTime: number): number {
  if (samples.length === 0) return 0;
  if (samples.length === 1) return samples[0].charIndex;

  // Before the first sample — clamp to first sample's value.
  if (renderTime <= samples[0].serverTime) return samples[0].charIndex;

  // Find the bracketing pair [a, b] where a.serverTime <= renderTime <= b.serverTime.
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (renderTime >= a.serverTime && renderTime <= b.serverTime) {
      const t = (renderTime - a.serverTime) / (b.serverTime - a.serverTime);
      return a.charIndex + t * (b.charIndex - a.charIndex);
    }
  }

  // Past the latest sample — extrapolate for up to EXTRAP_MS, then freeze.
  const last = samples[samples.length - 1];
  const prev = samples[samples.length - 2];
  const overshoot = renderTime - last.serverTime;
  if (overshoot <= EXTRAP_MS) {
    const dt = last.serverTime - prev.serverTime;
    if (dt <= 0) return last.charIndex;
    const velocity = (last.charIndex - prev.charIndex) / dt;
    return last.charIndex + overshoot * velocity;
  }
  return last.charIndex;
}

export function useInterpolatedProgress(
  userId: string,
  samplesRef: React.RefObject<Map<string, Sample[]>>,
  clockSyncIsReady: () => boolean,
  toServerTime: (clientMs: number) => number
): number {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const delay = clockSyncIsReady() ? STEADY_DELAY_MS : WARMUP_DELAY_MS;
      const renderTime = toServerTime(performance.now()) - delay;
      const samples = samplesRef.current?.get(userId) ?? [];
      setProgress(computeInterpolatedCharIndex(samples, renderTime));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [userId, samplesRef, clockSyncIsReady, toServerTime]);

  return progress;
}
