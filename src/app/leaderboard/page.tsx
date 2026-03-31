"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { LeaderboardEntry, Difficulty } from "@/types";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      const url =
        difficulty === "all"
          ? "/api/leaderboard"
          : `/api/leaderboard?difficulty=${difficulty}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        setEntries(data.entries || []);
      } catch {
        setEntries([]);
      }
      setLoading(false);
    }
    fetchLeaderboard();
  }, [difficulty]);

  function getRankStyle(index: number) {
    if (index === 0)
      return {
        color: "text-pixel-gold",
        glow: "text-glow-yellow",
        icon: "★",
        bg: "bg-pixel-bird-yellow/10",
      };
    if (index === 1)
      return {
        color: "text-pixel-silver",
        glow: "",
        icon: "☆",
        bg: "bg-pixel-silver/5",
      };
    if (index === 2)
      return {
        color: "text-pixel-bronze",
        glow: "",
        icon: "◆",
        bg: "bg-pixel-bronze/5",
      };
    return { color: "text-pixel-text-dim", glow: "", icon: "", bg: "" };
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Dark arcade background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #0A0A14 0%, #1A1A2E 50%, #0A0A14 100%)",
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,215,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.3) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center p-4">
        <div className="w-full max-w-2xl">
          {/* HUD Header */}
          <div className="game-hud px-4 py-3 mb-6 flex justify-between items-center">
            <Link
              href="/"
              className="font-heading text-pixel-bird-yellow text-xs hover:text-pixel-bird-orange text-glow-yellow"
            >
              Home
            </Link>
            <h1 className="font-heading text-pixel-text-white text-sm text-shadow-hard">
              HIGH SCORES
            </h1>
            <Link
              href="/play"
              className="font-heading text-pixel-text-green text-[10px] hover:text-pixel-grass text-glow-green"
            >
              Play
            </Link>
          </div>

          {/* Arcade screen title */}
          <div className="text-center mb-6">
            <h2 className="font-heading text-pixel-bird-yellow text-xl text-glow-yellow mb-2">
              LEADERBOARD
            </h2>
            <div className="flex justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  className="animate-sparkle text-pixel-bird-yellow text-xs"
                  style={{ animationDelay: `${i * 0.2}s` }}
                >
                  ★
                </span>
              ))}
            </div>
          </div>

          {/* Difficulty filter tabs — game menu style */}
          <div className="flex gap-2 mb-6 justify-center">
            {(["all", "short", "medium", "long"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`font-heading text-[8px] px-4 py-2 transition-all ${
                  difficulty === d
                    ? "pixel-select-active text-pixel-bird-yellow"
                    : "pixel-select text-pixel-text-dim hover:text-pixel-text-white"
                }`}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Score table in arcade cabinet */}
          <div className="pixel-panel-gold">
            {/* Header row */}
            <div className="grid grid-cols-[50px_1fr_80px_80px] gap-2 p-4 border-b-4 border-pixel-bird-yellow/30">
              <span className="font-heading text-[8px] text-pixel-bird-yellow">
                RANK
              </span>
              <span className="font-heading text-[8px] text-pixel-bird-yellow">
                PLAYER
              </span>
              <span className="font-heading text-[8px] text-pixel-bird-yellow text-right">
                WPM
              </span>
              <span className="font-heading text-[8px] text-pixel-bird-yellow text-right">
                ACC
              </span>
            </div>

            {loading && (
              <div className="p-12 text-center">
                <div className="animate-float mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/sprites/robin.png"
                    alt="Loading"
                    className="w-8 h-8 mx-auto"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
                <span className="font-heading text-pixel-text-dim text-xs animate-pulse">
                  Loading...
                </span>
              </div>
            )}

            {!loading && entries.length === 0 && (
              <div className="p-12 text-center">
                <p className="font-mono text-pixel-text-dim text-sm mb-4">
                  No scores yet. Be the first!
                </p>
                <Link
                  href="/play"
                  className="pixel-btn font-heading text-[10px] px-6 py-2 text-pixel-black inline-block"
                >
                  Start Racing
                </Link>
              </div>
            )}

            {!loading &&
              entries.map((entry, i) => {
                const rank = getRankStyle(i);
                return (
                  <div
                    key={`${entry.userId}-${i}`}
                    className={`grid grid-cols-[50px_1fr_80px_80px] gap-2 p-4 border-b border-pixel-text-dim/15 last:border-b-0 hover:bg-pixel-navy/50 transition-colors animate-slide-up ${rank.bg}`}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className="flex items-center gap-1">
                      {rank.icon && (
                        <span
                          className={`${rank.color} text-sm ${
                            i === 0 ? "animate-sparkle" : ""
                          }`}
                        >
                          {rank.icon}
                        </span>
                      )}
                      <span
                        className={`font-heading text-[10px] ${rank.color} ${rank.glow}`}
                      >
                        {i + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/sprites/${entry.displayBird || "robin"}.png`}
                        alt=""
                        className="w-6 h-6"
                        style={{ imageRendering: "pixelated" }}
                      />
                      <span className="font-mono text-pixel-text-white text-sm truncate">
                        {entry.username}
                      </span>
                    </div>
                    <span
                      className={`font-heading text-[10px] text-right self-center ${
                        i === 0
                          ? "text-pixel-text-green text-glow-green"
                          : "text-pixel-text-green"
                      }`}
                    >
                      {entry.wpm}
                    </span>
                    <span className="font-heading text-[10px] text-pixel-text-white text-right self-center">
                      {Math.round(entry.accuracy * 100)}%
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Bottom decorative bar */}
          <div className="mt-6 text-center">
            <p className="font-heading text-[8px] text-pixel-text-dim animate-blink">
              INSERT COIN TO CONTINUE
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
