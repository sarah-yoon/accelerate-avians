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
      <main className="flex items-center justify-center min-h-screen bg-pixel-black">
        <p className="font-heading text-pixel-text-dim text-xs animate-pulse">
          Loading...
        </p>
      </main>
    );
  }

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
            Profile
          </h1>
          <Link
            href="/play"
            className="font-heading text-pixel-text-green text-[10px] hover:text-pixel-grass"
          >
            Play
          </Link>
        </div>

        {loading && (
          <div className="text-center mt-12">
            <span className="font-heading text-pixel-text-dim text-xs animate-pulse">
              Loading stats...
            </span>
          </div>
        )}

        {!loading && !stats && (
          <div className="text-center mt-12">
            <p className="font-typing text-pixel-text-dim text-sm mb-4">
              No races yet!
            </p>
            <Link
              href="/play"
              className="bg-pixel-grass text-pixel-black font-heading text-[10px] px-6 py-3 inline-block"
            >
              Start Racing
            </Link>
          </div>
        )}

        {!loading && stats && (
          <>
            {/* User info */}
            <div className="bg-pixel-panel border-2 border-pixel-text-dim p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-16 h-16 border-2 border-pixel-bird-yellow"
                  style={{ imageRendering: "pixelated" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/sprites/${stats.displayBird}.png`}
                    alt={stats.displayBird}
                    className="w-full h-full object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
                <div>
                  <h2 className="font-heading text-pixel-text-white text-sm">
                    {stats.username}
                  </h2>
                  <p className="font-typing text-pixel-text-dim text-xs">
                    {stats.totalRaces} races completed
                  </p>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="font-heading text-[8px] text-pixel-text-dim mb-1">
                    AVG WPM
                  </p>
                  <p className="font-heading text-lg text-pixel-text-green">
                    {stats.avgWpm}
                  </p>
                </div>
                <div>
                  <p className="font-heading text-[8px] text-pixel-text-dim mb-1">
                    AVG ACC
                  </p>
                  <p className="font-heading text-lg text-pixel-text-white">
                    {Math.round(stats.avgAccuracy * 100)}%
                  </p>
                </div>
                <div>
                  <p className="font-heading text-[8px] text-pixel-text-dim mb-1">
                    RACES
                  </p>
                  <p className="font-heading text-lg text-pixel-bird-yellow">
                    {stats.totalRaces}
                  </p>
                </div>
              </div>
            </div>

            {/* Recent races */}
            <h3 className="font-heading text-pixel-text-white text-xs mb-3">
              Recent Races
            </h3>
            <div className="bg-pixel-panel border-2 border-pixel-text-dim">
              <div className="grid grid-cols-[1fr_80px_80px] gap-2 p-3 border-b border-pixel-text-dim">
                <span className="font-heading text-[8px] text-pixel-text-dim">
                  Date
                </span>
                <span className="font-heading text-[8px] text-pixel-text-dim text-right">
                  WPM
                </span>
                <span className="font-heading text-[8px] text-pixel-text-dim text-right">
                  ACC
                </span>
              </div>

              {stats.recentRaces.map((race, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_80px_80px] gap-2 p-3 border-b border-pixel-text-dim/30 last:border-b-0"
                >
                  <span className="font-typing text-pixel-text-white text-xs">
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
                <div className="p-4 text-center">
                  <span className="font-typing text-pixel-text-dim text-sm">
                    No recent races
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
