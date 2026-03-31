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
    <main className="flex flex-col items-center min-h-screen bg-pixel-black p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Link
            href="/"
            className="font-heading text-pixel-bird-yellow text-xs hover:text-pixel-bird-orange"
          >
            Home
          </Link>
          <h1 className="font-heading text-pixel-text-white text-sm">
            Leaderboard
          </h1>
          <Link
            href="/play"
            className="font-heading text-pixel-text-green text-[10px] hover:text-pixel-grass"
          >
            Play
          </Link>
        </div>

        {/* Difficulty filter */}
        <div className="flex gap-2 mb-6 justify-center">
          {(["all", "short", "medium", "long"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`font-heading text-[8px] px-3 py-2 border ${
                difficulty === d
                  ? "border-pixel-bird-yellow text-pixel-bird-yellow bg-pixel-navy"
                  : "border-pixel-text-dim text-pixel-text-dim hover:text-pixel-text-white"
              }`}
            >
              {d.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-pixel-panel border-2 border-pixel-text-dim">
          {/* Header row */}
          <div className="grid grid-cols-[40px_1fr_80px_80px] gap-2 p-3 border-b border-pixel-text-dim">
            <span className="font-heading text-[8px] text-pixel-text-dim">
              #
            </span>
            <span className="font-heading text-[8px] text-pixel-text-dim">
              Player
            </span>
            <span className="font-heading text-[8px] text-pixel-text-dim text-right">
              WPM
            </span>
            <span className="font-heading text-[8px] text-pixel-text-dim text-right">
              ACC
            </span>
          </div>

          {loading && (
            <div className="p-8 text-center">
              <span className="font-heading text-pixel-text-dim text-xs animate-pulse">
                Loading...
              </span>
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div className="p-8 text-center">
              <span className="font-typing text-pixel-text-dim text-sm">
                No scores yet. Be the first!
              </span>
            </div>
          )}

          {!loading &&
            entries.map((entry, i) => (
              <div
                key={`${entry.userId}-${i}`}
                className="grid grid-cols-[40px_1fr_80px_80px] gap-2 p-3 border-b border-pixel-text-dim/30 last:border-b-0 hover:bg-pixel-navy/50"
              >
                <span className="font-heading text-[10px] text-pixel-bird-yellow">
                  {i + 1}
                </span>
                <span className="font-typing text-pixel-text-white text-sm truncate">
                  {entry.username}
                </span>
                <span className="font-heading text-[10px] text-pixel-text-green text-right">
                  {entry.wpm}
                </span>
                <span className="font-heading text-[10px] text-pixel-text-white text-right">
                  {Math.round(entry.accuracy * 100)}%
                </span>
              </div>
            ))}
        </div>
      </div>
    </main>
  );
}
