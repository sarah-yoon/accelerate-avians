"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeRacePhase } from "@/lib/race-phase-signal";
import { getAudioMuted, setAudioMuted } from "@/hooks/useAudio";
import { getCrtEnabled, setCrtEnabled } from "./CrtEffect";

const MOTION_KEY = "aa.motion.reduced";
const CONTRAST_KEY = "aa.contrast.high";

/**
 * Spec § 3.4 — minimal settings popover. Gear icon top-right of every
 * page, opens a panel with two toggles (reduced motion override,
 * high-contrast stub). Disabled during an active race (prop
 * `disabled`). Escape closes; initial focus on first toggle.
 *
 * Audio toggle is deferred to Phase 5.3 (audio hook doesn't exist yet).
 */
interface SettingsPopoverProps {
  /** When true, the gear is greyed out and clicking it does nothing. */
  disabled?: boolean;
}

export function SettingsPopover({ disabled: disabledProp }: SettingsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [motionReduced, setMotionReduced] = useState<boolean | null>(null);
  const [highContrast, setHighContrast] = useState(false);
  const [muted, setMuted] = useState(true);
  const [crtEnabled, setCrtState] = useState(true);
  const [racing, setRacing] = useState(false);
  const disabled = disabledProp || racing;

  // Auto-disable during a race (spec § 3.4) — prevents focus-stealing
  // when the user clicks the gear while typing. Subscribes to the
  // module-level race-phase signal so we don't need React context.
  useEffect(() => {
    return subscribeRacePhase((p) => {
      const active = p === "racing" || p === "countdown";
      setRacing(active);
      if (active) setOpen(false);
    });
  }, []);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstToggleRef = useRef<HTMLButtonElement>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const motion = window.localStorage.getItem(MOTION_KEY);
    if (motion === "true") setMotionReduced(true);
    else if (motion === "false") setMotionReduced(false);
    else setMotionReduced(null);

    const contrast = window.localStorage.getItem(CONTRAST_KEY) === "true";
    setHighContrast(contrast);
    if (contrast) document.documentElement.setAttribute("data-aa-contrast", "high");

    setMuted(getAudioMuted());
    setCrtState(getCrtEnabled());
  }, []);

  // Apply high-contrast root attribute whenever the flag changes
  useEffect(() => {
    if (highContrast) document.documentElement.setAttribute("data-aa-contrast", "high");
    else document.documentElement.removeAttribute("data-aa-contrast");
  }, [highContrast]);

  // Escape to close; initial focus trap
  useEffect(() => {
    if (!open) return;
    firstToggleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    // Defer one tick so the gear click doesn't immediately close
    const timer = setTimeout(() => window.addEventListener("mousedown", onClick), 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const setMotion = (override: boolean | null) => {
    if (override === null) window.localStorage.removeItem(MOTION_KEY);
    else window.localStorage.setItem(MOTION_KEY, String(override));
    setMotionReduced(override);
    // Trigger the `storage` event for same-tab useReducedMotion subscribers
    window.dispatchEvent(new StorageEvent("storage", { key: MOTION_KEY, newValue: override == null ? null : String(override) }));
  };

  const toggleContrast = () => {
    const next = !highContrast;
    window.localStorage.setItem(CONTRAST_KEY, String(next));
    setHighContrast(next);
  };

  const toggleMuted = () => {
    const next = !muted;
    setAudioMuted(next);
    setMuted(next);
  };

  const toggleCrt = () => {
    const next = !crtEnabled;
    setCrtEnabled(next);
    setCrtState(next);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-label={disabled ? "Settings (disabled during race)" : "Open settings"}
        title={disabled ? "Settings available between races" : "Settings"}
        className={`fixed top-3 right-3 z-30 w-10 h-10 flex items-center justify-center text-[28px] leading-none border-2 ${
          disabled
            ? "border-pixel-text-dim text-pixel-text-dim cursor-not-allowed opacity-40"
            : "border-pixel-text-white text-pixel-text-white hover:border-pixel-bird-yellow hover:text-pixel-bird-yellow bg-pixel-panel"
        }`}
      >
        ⚙
      </button>

      {open && !disabled && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Settings"
          className="fixed top-16 right-3 z-30 w-64 bg-pixel-panel border-2 border-pixel-text-white p-4 text-pixel-text-white"
        >
          <h2 className="font-heading text-pixel-bird-yellow text-[9px] tracking-widest mb-3">
            SETTINGS
          </h2>

          <div className="mb-4">
            <p className="font-heading text-[7px] text-pixel-text-dim mb-2 tracking-wider">
              MOTION
            </p>
            <div className="flex gap-1">
              {[
                { label: "OS", value: null as boolean | null },
                { label: "REDUCE", value: true as boolean | null },
                { label: "FULL", value: false as boolean | null },
              ].map((opt, i) => (
                <button
                  key={opt.label}
                  ref={i === 0 ? firstToggleRef : undefined}
                  onClick={() => setMotion(opt.value)}
                  className={`flex-1 font-heading text-[7px] py-1.5 border ${
                    motionReduced === opt.value
                      ? "bg-pixel-bird-yellow text-pixel-black border-pixel-bird-yellow"
                      : "border-pixel-text-dim text-pixel-text-dim hover:border-pixel-text-white hover:text-pixel-text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="font-heading text-[7px] text-pixel-text-dim mb-2 tracking-wider">
              SOUND
            </p>
            <button
              onClick={toggleMuted}
              className={`w-full font-heading text-[7px] py-1.5 border ${
                !muted
                  ? "bg-pixel-bird-yellow text-pixel-black border-pixel-bird-yellow"
                  : "border-pixel-text-dim text-pixel-text-dim hover:border-pixel-text-white hover:text-pixel-text-white"
              }`}
            >
              {muted ? "MUTED" : "ON"}
            </button>
          </div>

          <div className="mb-4">
            <p className="font-heading text-[7px] text-pixel-text-dim mb-2 tracking-wider">
              CRT EFFECT
            </p>
            <button
              onClick={toggleCrt}
              className={`w-full font-heading text-[7px] py-1.5 border ${
                crtEnabled
                  ? "bg-pixel-bird-yellow text-pixel-black border-pixel-bird-yellow"
                  : "border-pixel-text-dim text-pixel-text-dim hover:border-pixel-text-white hover:text-pixel-text-white"
              }`}
            >
              {crtEnabled ? "ON" : "OFF"}
            </button>
          </div>

          <div>
            <p className="font-heading text-[7px] text-pixel-text-dim mb-2 tracking-wider">
              HIGH CONTRAST
            </p>
            <button
              onClick={toggleContrast}
              className={`w-full font-heading text-[7px] py-1.5 border ${
                highContrast
                  ? "bg-pixel-bird-yellow text-pixel-black border-pixel-bird-yellow"
                  : "border-pixel-text-dim text-pixel-text-dim hover:border-pixel-text-white hover:text-pixel-text-white"
              }`}
            >
              {highContrast ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
