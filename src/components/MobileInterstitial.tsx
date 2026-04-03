"use client";

import { useState } from "react";

export function MobileInterstitial() {
  const [copied, setCopied] = useState(false);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-pixel-black p-8 md:hidden">
      <h1 className="font-heading text-pixel-bird-yellow text-sm text-center mb-6">
        Accelerate, Avians
      </h1>
      <p className="font-typing text-pixel-text-white text-center mb-2">
        is a desktop typing game.
      </p>
      <p className="font-typing text-pixel-text-dim text-center text-sm mb-8">
        Please visit on a device with a keyboard.
      </p>
      <button
        onClick={handleCopyLink}
        className="bg-pixel-panel border-2 border-pixel-text-dim font-heading text-[10px] text-pixel-text-white px-6 py-3 hover:border-pixel-bird-yellow active:bg-pixel-navy"
      >
        {copied ? "Link Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
