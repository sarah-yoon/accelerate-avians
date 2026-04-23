"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * ARIA live announcer (spec § 3.6). Renders into a portal attached to
 * `document.body` so the assertive region remains audible to screen
 * readers even when a parent wraps the race in an `inert` overlay.
 *
 * Announces time-critical race events: countdown (3, 2, 1), GO, race
 * finish with placement. Polite events (combo, opponent-finished) live
 * on the ComboMeter itself.
 */
interface LiveAnnouncerProps {
  /** Latest countdown value — 3, 2, 1, or "GO". */
  countdownValue: number | "GO" | null;
  /** Race phase. Announces on transitions to "countdown" and "finished". */
  phase: "idle" | "countdown" | "racing" | "finished";
  /** Result message, e.g. "Finished 1st of 4 — 92 WPM". Announced when phase becomes "finished". */
  resultMessage?: string | null;
}

export function LiveAnnouncer({ countdownValue, phase, resultMessage }: LiveAnnouncerProps) {
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (phase === "countdown" && countdownValue != null) {
      setMessage(String(countdownValue));
    }
  }, [countdownValue, phase]);

  useEffect(() => {
    if (phase === "racing") setMessage("Go");
  }, [phase]);

  useEffect(() => {
    if (phase === "finished" && resultMessage) setMessage(resultMessage);
  }, [phase, resultMessage]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0,0,0,0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {message}
    </div>,
    document.body
  );
}
