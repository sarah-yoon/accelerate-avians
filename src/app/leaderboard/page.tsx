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

  return (
    <main className="game-screen !justify-start !pt-8">
      <div className="w-full max-w-xl animate-slide-up">
        {/* Game menu nav */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="game-menu-item !p-0 !pl-5 text-[8px]">
            HOME
          </Link>
          <Link href="/play" className="game-menu-item !p-0 !pl-5 text-[8px]">
            PLAY
          </Link>
        </div>

        {/* Arcade title */}
        <h1 className="font-heading text-pixel-bird-yellow text-sm text-center mb-1 text-glow-yellow">
          HIGH SCORES
        </h1>
        <p className="font-heading text-[7px] text-pixel-text-dim text-center mb-6 tracking-widest">
          — TOP 100 PLAYERS —
        </p>

        {/* Filter tabs — game menu style */}
        <div className="flex gap-2 mb-6 justify-center">
          {(["all", "short", "medium", "long"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`font-heading text-[7px] px-4 py-2 transition-all ${
                difficulty === d
                  ? "pixel-select-active"
                  : "pixel-select"
              }`}
            >
              {d.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Score table */}
        <div className="pixel-panel">
          <div className="grid grid-cols-[36px_1fr_70px_70px] gap-2 px-4 py-3 border-b-2 border-pixel-text-dim">
            <span className="font-heading text-[7px] text-pixel-text-dim">#</span>
            <span className="font-heading text-[7px] text-pixel-text-dim">PLAYER</span>
            <span className="font-heading text-[7px] text-pixel-text-dim text-right">WPM</span>
            <span className="font-heading text-[7px] text-pixel-text-dim text-right">ACC</span>
          </div>

          {loading && (
            <div className="p-8 text-center">
              <span className="font-heading text-pixel-bird-yellow text-[10px] animate-pulse">LOADING...</span>
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div className="p-8 text-center">
              <span className="font-heading text-pixel-text-dim text-[9px]">NO SCORES YET</span>
              <br />
              <span className="font-heading text-pixel-text-dim text-[7px] mt-2 inline-block">BE THE FIRST!</span>
            </div>
          )}

          {!loading && entries.map((entry, i) => {
            const rankColor =
              i === 0 ? "text-pixel-gold" : i === 1 ? "text-pixel-silver" : i === 2 ? "text-pixel-bronze" : "text-pixel-text-dim";
            const rowBg = i % 2 === 0 ? "bg-pixel-navy/20" : "";
            return (
              <div
                key={`${entry.userId}-${i}`}
                className={`grid grid-cols-[36px_1fr_70px_70px] gap-2 px-4 py-3 ${rowBg} hover:bg-pixel-navy/40 transition-colors`}
              >
                <span className={`font-heading text-[10px] ${rankColor}`}>{i + 1}</span>
                <span className="text-pixel-text-white text-sm truncate">{entry.username}</span>
                <span className="font-heading text-[10px] text-pixel-text-green text-right">{entry.wpm}</span>
                <span className="font-heading text-[10px] text-pixel-text-white text-right">{Math.round(entry.accuracy * 100)}%</span>
              </div>
            );
          })}
        </div>

        {/* Bottom prompt */}
        <p className="font-heading text-[6px] text-pixel-text-dim text-center mt-6 animate-blink">
          PRESS PLAY TO CHALLENGE
        </p>
      </div>
    </main>
  );
}
