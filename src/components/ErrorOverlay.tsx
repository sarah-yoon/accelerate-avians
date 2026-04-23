"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";

export type ErrorKey =
  | "room-not-found"
  | "passage-load-failed"
  | "server-unreachable"
  | "signin-required";

interface ErrorDef {
  title: string;
  body: string;
  illustration: string; // single pixel emoji-ish character rendered large
  illustrationColor: string;
}

const DEFS: Record<ErrorKey, ErrorDef> = {
  "room-not-found": {
    title: "THAT NEST IS EMPTY",
    body: "The room code didn't match any open race. Check the code with your friend, or start a new one.",
    illustration: "◯",
    illustrationColor: "text-pixel-text-dim",
  },
  "passage-load-failed": {
    title: "COULDN'T LOAD THE PASSAGE",
    body: "Something went wrong fetching a race passage. Give it another try.",
    illustration: "✕",
    illustrationColor: "text-pixel-red",
  },
  "server-unreachable": {
    title: "THE FLOCK GOT LOST",
    body: "We can't reach the game server right now. Check your connection or try again in a moment.",
    illustration: "↯",
    illustrationColor: "text-pixel-bird-yellow",
  },
  "signin-required": {
    title: "YOUR PERCH TIMED OUT",
    body: "Sign in to keep racing — your session expired.",
    illustration: "☾",
    illustrationColor: "text-pixel-text-dim",
  },
};

interface ErrorOverlayProps {
  errorKey: ErrorKey;
  /** Primary action label + handler (e.g. "Try Again"). */
  primary?: { label: string; onClick: () => void };
  /** Secondary action — defaults to "Back to Home" (/). */
  secondary?: { label: string; href: string };
  onClose?: () => void;
}

/**
 * Spec § 3.3.3 — themed error surfaces. Four concrete error keys; the
 * spec's larger 9-state closed list is trimmed to the error paths that
 * actually exist in the current UI today. Illustrations are single
 * glyphs rather than sprite files (honest portfolio-scope shortcut).
 */
export function ErrorOverlay({ errorKey, primary, secondary, onClose }: ErrorOverlayProps) {
  const def = DEFS[errorKey];
  const primaryRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    primaryRef.current?.focus();
    return () => previouslyFocusedRef.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sec = secondary ?? { label: "Back to Home", href: "/" };

  return (
    <div
      role="alertdialog"
      aria-labelledby="error-title"
      aria-describedby="error-body"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-6"
    >
      <div className="bg-pixel-panel border-2 border-pixel-text-white p-8 max-w-sm text-center">
        <div className={`text-5xl mb-4 ${def.illustrationColor}`}>{def.illustration}</div>
        <h2
          id="error-title"
          className="font-heading text-pixel-bird-yellow text-[10px] tracking-widest mb-3 text-glow-yellow"
        >
          {def.title}
        </h2>
        <p id="error-body" className="font-typing text-pixel-text-white text-sm mb-6">
          {def.body}
        </p>
        <div className="flex flex-col gap-2">
          {primary && (
            <button
              ref={primaryRef}
              onClick={primary.onClick}
              className="font-heading text-[9px] bg-pixel-bird-yellow text-pixel-black px-6 py-3"
            >
              {primary.label.toUpperCase()}
            </button>
          )}
          <Link
            href={sec.href}
            className="font-heading text-[8px] border border-pixel-text-dim text-pixel-text-white px-6 py-2 hover:border-pixel-text-white"
          >
            {sec.label.toUpperCase()}
          </Link>
        </div>
      </div>
    </div>
  );
}
