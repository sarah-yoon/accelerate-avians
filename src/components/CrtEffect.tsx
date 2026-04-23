"use client";

import { useEffect, useState } from "react";

const CRT_KEY = "crt-enabled";

export function CrtEffect() {
  const [enabled, setEnabled] = useState(true);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CRT_KEY);
    if (stored === "false") setEnabled(false);
    requestAnimationFrame(() => setBooted(true));

    // Listen for toggle events from SettingsPopover (same-tab storage event
    // dispatched synthetically after setItem).
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CRT_KEY) return;
      setEnabled(e.newValue !== "false");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <>
      {enabled && (
        <>
          <div className="crt-overlay-scanlines" />
          <div className="crt-overlay-vignette" />
          <div className="crt-overlay-rgb" />
          <div className="crt-overlay-flicker" />
        </>
      )}

      <BodyClassManager enabled={enabled} booted={booted} />
    </>
  );
}

export function getCrtEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(CRT_KEY) !== "false";
}

export function setCrtEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CRT_KEY, String(enabled));
  window.dispatchEvent(
    new StorageEvent("storage", { key: CRT_KEY, newValue: String(enabled) })
  );
}

function BodyClassManager({ enabled, booted }: { enabled: boolean; booted: boolean }) {
  useEffect(() => {
    const body = document.body;
    if (enabled) {
      body.classList.add("crt-active");
      if (booted) {
        body.classList.add("crt-booting");
        const timer = setTimeout(() => body.classList.remove("crt-booting"), 500);
        return () => clearTimeout(timer);
      }
    } else {
      body.classList.remove("crt-active", "crt-booting");
    }
  }, [enabled, booted]);

  return null;
}
