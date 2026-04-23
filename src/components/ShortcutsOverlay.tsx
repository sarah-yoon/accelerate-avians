"use client";
import { useEffect, useRef, useState } from "react";
import { subscribeRacePhase } from "@/lib/race-phase-signal";

interface Shortcut { keys: string; desc: string; }

const SHORTCUTS: Shortcut[] = [
  { keys: "F1", desc: "Show this overlay" },
  { keys: "Esc", desc: "Close modal / leave race (confirm)" },
  { keys: "Enter", desc: "Ready up in lobby · submit on results" },
  { keys: "M", desc: "Mute toggle (in menus)" },
  { keys: "Tab ↹", desc: "Navigate controls (race input consumes unmodified Tab as a passage char)" },
];

/**
 * Spec § 3.6 — keyboard-shortcut reference. F1 opens, Esc closes.
 * Suppressed during an active race so the dialog doesn't steal focus
 * from the typing input.
 */
export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(
    () =>
      subscribeRacePhase((p) => setBlocked(p === "racing" || p === "countdown")),
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        if (!blocked) setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, blocked]);

  useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-label="Keyboard shortcuts"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-pixel-panel border-2 border-pixel-text-white p-6 max-w-md w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-pixel-bird-yellow text-[10px] tracking-widest mb-4 text-glow-yellow">
          KEYBOARD SHORTCUTS
        </h2>
        <div className="space-y-2 mb-4">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-start gap-4">
              <kbd className="font-heading text-[8px] border border-pixel-text-dim px-2 py-1 text-pixel-text-white min-w-[60px] text-center">
                {s.keys}
              </kbd>
              <span className="text-[11px] text-pixel-text-white font-typing flex-1">
                {s.desc}
              </span>
            </div>
          ))}
        </div>
        <button
          ref={closeBtnRef}
          onClick={() => setOpen(false)}
          className="font-heading text-[8px] bg-pixel-bird-yellow text-pixel-black px-4 py-2"
        >
          CLOSE (ESC)
        </button>
      </div>
    </div>
  );
}
