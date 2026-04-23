"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const MUTE_KEY = "aa.audio.muted";

type Sfx = "correct" | "incorrect" | "countdown" | "finish";

/**
 * Minimal synth-based SFX — spec § 3.2. All sounds are generated via
 * WebAudio oscillators; no asset files. Muted by default. Toggled
 * via SettingsPopover writing localStorage + a same-tab storage event.
 *
 * Sound design (very short, bird-adjacent):
 *   - correct:   5ms triangle tone at 880 Hz, -12dB, decay 60ms
 *   - incorrect: 30ms square tone at 180 Hz, -18dB, decay 120ms
 *   - countdown: 80ms triangle at [520 / 600 / 700] Hz, decay 200ms
 *   - finish:    ascending arpeggio 660 → 880 → 1320, 60ms each
 */
export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const [muted, setMuted] = useState(true);

  // Read initial mute state + subscribe to same-tab changes
  useEffect(() => {
    const initial = window.localStorage.getItem(MUTE_KEY);
    setMuted(initial !== "false"); // default muted (missing → true)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== MUTE_KEY) return;
      setMuted(e.newValue !== "false");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Lazily construct AudioContext on first user interaction — browsers
  // require a gesture before .start() will be heard.
  const ensureCtx = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    ctxRef.current = ctx;
    masterRef.current = master;
    return ctx;
  }, []);

  const blip = useCallback(
    (freq: number, durMs: number, type: OscillatorType, gainDb: number, offsetMs = 0) => {
      if (muted) return;
      const ctx = ensureCtx();
      if (!ctx || !masterRef.current) return;
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const startLevel = Math.pow(10, gainDb / 20);
      const now = ctx.currentTime + offsetMs / 1000;
      gain.gain.setValueAtTime(startLevel, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
      osc.connect(gain);
      gain.connect(masterRef.current);
      osc.start(now);
      osc.stop(now + durMs / 1000 + 0.02);
    },
    [muted, ensureCtx]
  );

  const play = useCallback(
    (kind: Sfx) => {
      if (muted) return;
      switch (kind) {
        case "correct":
          blip(880, 60, "triangle", -18);
          return;
        case "incorrect":
          blip(180, 120, "square", -18);
          return;
        case "countdown":
          blip(520, 200, "triangle", -15);
          return;
        case "finish":
          blip(660, 80, "triangle", -12, 0);
          blip(880, 80, "triangle", -12, 80);
          blip(1320, 120, "triangle", -10, 160);
          return;
      }
    },
    [muted, blip]
  );

  return { play, muted };
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, String(muted));
  window.dispatchEvent(
    new StorageEvent("storage", { key: MUTE_KEY, newValue: String(muted) })
  );
}

export function getAudioMuted(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MUTE_KEY) !== "false";
}
