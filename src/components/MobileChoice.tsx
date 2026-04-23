"use client";

import { useEffect, useState } from "react";

const OVERRIDE_KEY = "aa.mobile.continue-anyway";

/**
 * Spec § 3.3 — soft mobile block. Shows a themed message when the device is
 * touch-only (pointer: coarse AND NOT pointer: fine, so iPad + Magic Keyboard
 * is allowed through). Users can click "Continue Anyway" to dismiss, with
 * the choice persisted in localStorage.
 */
export function MobileChoice() {
  const [shouldShow, setShouldShow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const override = window.localStorage.getItem(OVERRIDE_KEY);
    if (override === "1") {
      setShouldShow(false);
      return;
    }
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    // Touch-only: coarse pointer, no fine-pointer device attached.
    setShouldShow(coarse && !fine);
  }, []);

  if (!shouldShow) return null;

  const dismiss = () => {
    window.localStorage.setItem(OVERRIDE_KEY, "1");
    setShouldShow(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — fall back to selection hint
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-pixel-black p-8">
      <h1 className="font-heading text-pixel-bird-yellow text-sm text-center mb-3 text-glow-yellow">
        Accelerate, Avians
      </h1>
      <p className="font-heading text-pixel-text-white text-[10px] text-center mb-2 tracking-wider">
        COME BACK ON A LAPTOP
      </p>
      <p className="font-typing text-pixel-text-dim text-center text-sm mb-8 max-w-xs">
        Birds need keyboards — this is a typing game, and typing on a phone
        isn&apos;t fun. But you can try anyway.
      </p>
      <div className="flex flex-col gap-3 items-center w-64">
        <button
          onClick={dismiss}
          className="pixel-btn font-heading text-[9px] px-6 py-3 text-pixel-black w-full"
        >
          ▶ CONTINUE ANYWAY
        </button>
        <button
          onClick={copyLink}
          className="bg-pixel-panel border-2 border-pixel-text-dim font-heading text-[8px] text-pixel-text-white px-6 py-2 hover:border-pixel-bird-yellow active:bg-pixel-navy w-full"
        >
          {copied ? "LINK COPIED!" : "COPY LINK FOR LAPTOP"}
        </button>
      </div>
    </div>
  );
}
