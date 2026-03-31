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
        if (res.ok) setStats(await res.json());
      } catch { /* profile may not exist yet */ }
      setLoading(false);
    }
    fetchProfile();
  }, [isLoaded, user]);

  if (!isLoaded) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-pixel-black">
        <p className="font-heading text-pixel-text-dim text-[10px] animate-pulse">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center min-h-screen bg-pixel-black px-6 py-8">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="font-heading text-pixel-bird-yellow text-[8px] hover:text-pixel-bird-orange">
            ← Home
          </Link>
          <h1 className="font-heading text-pixel-text-white text-xs">PROFILE</h1>
          <Link href="/play" className="font-heading text-pixel-text-green text-[8px] hover:text-pixel-grass">
            Play →
          </Link>
        </div>

        {loading && (
          <div className="text-center mt-16">
            <span className="font-heading text-pixel-text-dim text-[10px] animate-pulse">Loading stats...</span>
          </div>
        )}

        {!loading && !stats && (
          <div className="text-center mt-16">
            <p className="text-pixel-text-dim text-sm mb-6">No races yet!</p>
            <Link href="/play" className="pixel-btn font-heading text-[8px] px-6 py-3 text-pixel-black inline-block">
              Start Racing
            </Link>
          </div>
        )}

        {!loading && stats && (
          <>
            {/* Player card */}
            <div className="pixel-panel p-6 mb-6">
              <div className="flex items-center gap-5 mb-6">
                <div className="w-14 h-14 border-2 border-pixel-bird-yellow flex items-center justify-center bg-pixel-navy">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/sprites/${stats.displayBird}.png`}
                    alt={stats.displayBird}
                    className="w-10 h-10"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
                <div>
                  <h2 className="font-heading text-pixel-text-white text-xs mb-1">{stats.username}</h2>
                  <p className="text-pixel-text-dim text-xs">{stats.totalRaces} races</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-pixel-navy p-3">
                  <p className="font-heading text-[7px] text-pixel-text-dim mb-2">AVG WPM</p>
                  <p className="font-heading text-lg text-pixel-text-green">{stats.avgWpm}</p>
                </div>
                <div className="bg-pixel-navy p-3">
                  <p className="font-heading text-[7px] text-pixel-text-dim mb-2">AVG ACC</p>
                  <p className="font-heading text-lg text-pixel-text-white">{Math.round(stats.avgAccuracy * 100)}%</p>
                </div>
                <div className="bg-pixel-navy p-3">
                  <p className="font-heading text-[7px] text-pixel-text-dim mb-2">RACES</p>
                  <p className="font-heading text-lg text-pixel-bird-yellow">{stats.totalRaces}</p>
                </div>
              </div>
            </div>

            {/* Recent races */}
            <h3 className="font-heading text-pixel-text-white text-[10px] mb-3">RECENT RACES</h3>
            <div className="pixel-panel">
              <div className="grid grid-cols-[1fr_70px_70px] gap-2 px-4 py-3 border-b-2 border-pixel-text-dim">
                <span className="font-heading text-[7px] text-pixel-text-dim">DATE</span>
                <span className="font-heading text-[7px] text-pixel-text-dim text-right">WPM</span>
                <span className="font-heading text-[7px] text-pixel-text-dim text-right">ACC</span>
              </div>
              {stats.recentRaces.map((race, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_70px_70px] gap-2 px-4 py-3 border-b border-pixel-text-dim/20 last:border-b-0"
                >
                  <span className="text-pixel-text-white text-xs">{new Date(race.createdAt).toLocaleDateString()}</span>
                  <span className="font-heading text-[10px] text-pixel-text-green text-right">{race.wpm}</span>
                  <span className="font-heading text-[10px] text-pixel-text-white text-right">{Math.round(race.accuracy * 100)}%</span>
                </div>
              ))}
              {stats.recentRaces.length === 0 && (
                <div className="p-6 text-center">
                  <span className="text-pixel-text-dim text-sm">No recent races</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
