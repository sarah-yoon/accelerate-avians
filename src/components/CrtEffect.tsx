"use client";

import { useEffect, useState } from "react";

export function CrtEffect() {
  const [enabled, setEnabled] = useState(true);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("crt-enabled");
    if (stored === "false") setEnabled(false);
    // Trigger boot animation after a frame
    requestAnimationFrame(() => setBooted(true));
  }, []);

  useEffect(() => {
    localStorage.setItem("crt-enabled", String(enabled));
  }, [enabled]);

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

      <button
        className={`crt-toggle ${enabled ? "crt-toggle-on" : "crt-toggle-off"}`}
        onClick={() => setEnabled(!enabled)}
      >
        CRT {enabled ? "ON" : "OFF"}
      </button>

      <BodyClassManager enabled={enabled} booted={booted} />
    </>
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
