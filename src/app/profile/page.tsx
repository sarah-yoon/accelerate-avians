"use client";

import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { ProfileStats } from "@/types";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !user) return;

    async function fetchProfile() {
      try {
        const res = await fetch(`/api/profile/${user!.id}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch {
        // Profile may not exist yet
      }
      setLoading(false);
    }
    fetchProfile();
  }, [isLoaded, user]);

  if (!isLoaded) {
    return (
      <main className="flex items-center justify-center min-h-screen relative">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #0A0A14 0%, #1A1A2E 50%, #0A0A14 100%)",
          }}
        />
        <div className="relative z-10 animate-float">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sprites/robin.png"
            alt="Loading"
            className="w-10 h-10 mx-auto mb-4"
            style={{ imageRendering: "pixelated" }}
          />
          <p className="font-heading text-pixel-text-dim text-xs animate-pulse">
            Loading...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #0A0A14 0%, #1A1A2E 50%, #2A2A3E 100%)",
        }}
      />

      {/* Subtle pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(52,152,219,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(52,152,219,0.4) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
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
              PLAYER STATS
            </h1>
            <Link
              href="/play"
              className="font-heading text-pixel-text-green text-[10px] hover:text-pixel-grass text-glow-green"
            >
              Play
            </Link>
          </div>

          {loading && (
            <div className="text-center mt-12">
              <div className="animate-float mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sprites/robin.png"
                  alt="Loading"
                  className="w-10 h-10 mx-auto"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <span className="font-heading text-pixel-text-dim text-xs animate-pulse">
                Loading stats...
              </span>
            </div>
          )}

          {!loading && !stats && (
            <div className="text-center mt-12 animate-slide-up">
              <div className="pixel-panel-gold p-8 max-w-sm mx-auto">
                <p className="font-heading text-pixel-bird-yellow text-xs mb-2">
                  NO DATA
                </p>
                <p className="font-mono text-pixel-text-dim text-sm mb-6">
                  Complete your first race to see stats!
                </p>
                <Link
                  href="/play"
                  className="pixel-btn font-heading text-[10px] px-8 py-3 text-pixel-black inline-block"
                >
                  Start Racing
                </Link>
              </div>
            </div>
          )}

          {!loading && stats && (
            <>
              {/* Player card */}
              <div className="pixel-panel-gold p-6 mb-6 animate-bounce-in">
                <div className="flex items-center gap-6 mb-6">
                  {/* Big bird sprite */}
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-pixel-bird-yellow bg-pixel-navy p-2 animate-float">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/sprites/${stats.displayBird}.png`}
                        alt={stats.displayBird}
                        className="w-full h-full object-contain"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </div>
                    {/* Level badge */}
                    <div className="absolute -bottom-2 -right-2 bg-pixel-bird-yellow text-pixel-black font-heading text-[8px] px-2 py-1">
                      LV{Math.min(99, Math.floor(stats.totalRaces / 5) + 1)}
                    </div>
                  </div>

                  <div>
                    <h2 className="font-heading text-pixel-text-white text-base mb-1 text-shadow-hard">
                      {stats.username}
                    </h2>
                    <p className="font-mono text-pixel-text-dim text-xs">
                      {stats.totalRaces} races completed
                    </p>
                    <p className="font-mono text-pixel-bird-yellow text-xs mt-1">
                      {stats.displayBird.charAt(0).toUpperCase() +
                        stats.displayBird.slice(1)}{" "}
                      main
                    </p>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="pixel-panel p-4 text-center">
                    <p className="font-heading text-[8px] text-pixel-text-dim mb-2">
                      AVG WPM
                    </p>
                    <p className="font-heading text-xl text-pixel-text-green text-glow-green">
                      {stats.avgWpm}
                    </p>
                  </div>
                  <div className="pixel-panel p-4 text-center">
                    <p className="font-heading text-[8px] text-pixel-text-dim mb-2">
                      BEST WPM
                    </p>
                    <p className="font-heading text-xl text-pixel-bird-yellow text-glow-yellow">
                      {stats.bestWpm}
                    </p>
                  </div>
                  <div className="pixel-panel p-4 text-center">
                    <p className="font-heading text-[8px] text-pixel-text-dim mb-2">
                      AVG ACC
                    </p>
                    <p className="font-heading text-xl text-pixel-text-white">
                      {Math.round(stats.avgAccuracy * 100)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Recent races — game stats table */}
              <div className="animate-slide-up">
                <div className="bg-pixel-navy border-x-4 border-t-4 border-pixel-bird-blue px-4 py-2">
                  <h3 className="font-heading text-pixel-bird-blue text-xs text-center">
                    RACE LOG
                  </h3>
                </div>
                <div className="pixel-panel">
                  <div className="grid grid-cols-[1fr_80px_80px] gap-2 p-3 border-b-4 border-pixel-text-dim/30">
                    <span className="font-heading text-[8px] text-pixel-bird-blue">
                      DATE
                    </span>
                    <span className="font-heading text-[8px] text-pixel-bird-blue text-right">
                      WPM
                    </span>
                    <span className="font-heading text-[8px] text-pixel-bird-blue text-right">
                      ACC
                    </span>
                  </div>

                  {stats.recentRaces.map((race, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_80px_80px] gap-2 p-3 border-b border-pixel-text-dim/15 last:border-b-0 hover:bg-pixel-navy/50 transition-colors animate-slide-up"
                      style={{ animationDelay: `${i * 0.05}s` }}
                    >
                      <span className="font-mono text-pixel-text-white text-xs">
                        {new Date(race.createdAt).toLocaleDateString()}
                      </span>
                      <span className="font-heading text-[10px] text-pixel-text-green text-right">
                        {race.wpm}
                      </span>
                      <span className="font-heading text-[10px] text-pixel-text-white text-right">
                        {Math.round(race.accuracy * 100)}%
                      </span>
                    </div>
                  ))}

                  {stats.recentRaces.length === 0 && (
                    <div className="p-6 text-center">
                      <span className="font-mono text-pixel-text-dim text-sm">
                        No recent races
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom action */}
              <div className="mt-6 text-center">
                <Link
                  href="/play"
                  className="pixel-btn font-heading text-[10px] px-8 py-3 text-pixel-black inline-block"
                >
                  Race Again
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
