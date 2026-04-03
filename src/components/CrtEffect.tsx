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
      <style>{`
        /* CRT power-on animation */
        @keyframes crt-boot {
          0% {
            opacity: 0;
            transform: scaleY(0.005) scaleX(0.8);
            filter: brightness(3);
          }
          40% {
            opacity: 1;
            transform: scaleY(0.8) scaleX(1);
            filter: brightness(1.5);
          }
          70% {
            transform: scaleY(1.02) scaleX(1);
            filter: brightness(1.1);
          }
          100% {
            opacity: 1;
            transform: scaleY(1) scaleX(1);
            filter: brightness(1);
          }
        }

        /* CRT flicker */
        @keyframes crt-flicker {
          0%   { opacity: 0.10; }
          13%  { opacity: 0.12; }
          27%  { opacity: 0.08; }
          41%  { opacity: 0.13; }
          53%  { opacity: 0.09; }
          67%  { opacity: 0.11; }
          79%  { opacity: 0.08; }
          88%  { opacity: 0.12; }
          100% { opacity: 0.10; }
        }

        /* Screen curvature + chromatic aberration on body */
        body.crt-active {
          border-radius: 8px;
          text-shadow:
            1px 0 0.5px rgba(255, 0, 0, 0.06),
            -1px 0 0.5px rgba(0, 255, 255, 0.06);
        }

        /* Boot animation on body */
        body.crt-booting {
          animation: crt-boot 0.4s ease-out forwards;
        }

        /* Scanlines layer */
        .crt-overlay-scanlines {
          position: fixed;
          inset: 0;
          z-index: 9999;
          pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.10) 0px,
            rgba(0, 0, 0, 0.10) 1px,
            transparent 1px,
            transparent 3px
          );
        }

        /* Vignette layer */
        .crt-overlay-vignette {
          position: fixed;
          inset: 0;
          z-index: 9999;
          pointer-events: none;
          background: radial-gradient(
            ellipse at center,
            transparent 50%,
            rgba(0, 0, 0, 0.15) 75%,
            rgba(0, 0, 0, 0.45) 100%
          );
        }

        /* RGB phosphor mask layer */
        .crt-overlay-rgb {
          position: fixed;
          inset: 0;
          z-index: 9999;
          pointer-events: none;
          opacity: 0.04;
          background:
            repeating-linear-gradient(
              90deg,
              rgba(255, 0, 0, 1) 0px,
              rgba(255, 0, 0, 1) 1px,
              rgba(0, 255, 0, 1) 1px,
              rgba(0, 255, 0, 1) 2px,
              rgba(0, 0, 255, 1) 2px,
              rgba(0, 0, 255, 1) 3px
            );
        }

        /* Flicker layer */
        .crt-overlay-flicker {
          position: fixed;
          inset: 0;
          z-index: 9999;
          pointer-events: none;
          background: rgba(0, 0, 0, 1);
          animation: crt-flicker 0.15s infinite;
        }

        /* Toggle button */
        .crt-toggle {
          position: fixed;
          bottom: 12px;
          right: 12px;
          z-index: 10000;
          font-family: "Press Start 2P", monospace;
          font-size: 7px;
          padding: 6px 10px;
          border: 2px solid;
          cursor: pointer;
          transition: all 0.1s;
        }

        .crt-toggle-on {
          background: rgba(10, 10, 20, 0.8);
          border-color: #66BB6A;
          color: #66BB6A;
        }

        .crt-toggle-off {
          background: rgba(10, 10, 20, 0.8);
          border-color: #5A5A7A;
          color: #5A5A7A;
        }

        .crt-toggle:hover {
          border-color: #FFD700;
          color: #FFD700;
        }
      `}</style>

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
