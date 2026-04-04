"use client";

import { useUser } from "@clerk/nextjs";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { BirdSelector, ALL_BIRDS } from "@/components/BirdSelector";
import { BirdIcon } from "@/components/BirdIcon";
import { SkinSelector } from "@/components/SkinSelector";
import { WpmChart } from "@/components/WpmChart";
import type { ProfileStats } from "@/types";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBirdSelector, setShowBirdSelector] = useState(false);
  const [selectedBird, setSelectedBird] = useState("sparrow");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/profile/${user!.id}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
          setSelectedBird(data.displayBird);
        }
      } catch { /* profile may not exist yet */ }
      setLoading(false);
    }
    fetchProfile();
  }, [isLoaded, user]);

  const saveBird = useCallback(async (birdId: string) => {
    setSelectedBird(birdId);
    setSaving(true);
    try {
      await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayBird: birdId }),
      });
      if (stats) {
        setStats({ ...stats, displayBird: birdId });
      }
    } catch { /* silent fail */ }
    setSaving(false);
  }, [stats]);

  const birdDef = ALL_BIRDS.find((b) => b.id === (stats?.displayBird ?? "sparrow"));

  if (!isLoaded) {
    return (
      <main className="game-screen">
        <p className="font-heading text-pixel-bird-yellow text-[10px] animate-pulse text-glow-yellow">LOADING...</p>
      </main>
    );
  }

  return (
    <main className="game-screen !justify-start !pt-8">
      <div className="w-full max-w-2xl animate-slide-up">
        {/* Game menu nav */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="game-menu-item !p-0 !pl-5 text-[8px]">
            HOME
          </Link>
          <Link href="/play" className="game-menu-item !p-0 !pl-5 text-[8px]">
            PLAY
          </Link>
        </div>

        {/* Title */}
        <h1 className="font-heading text-pixel-bird-yellow text-sm text-center mb-1 text-glow-yellow">
          PROFILE
        </h1>
        <div className="game-divider mb-6" />

        {loading && (
          <div className="text-center mt-16">
            <span className="font-heading text-pixel-bird-yellow text-[10px] animate-pulse">LOADING STATS...</span>
          </div>
        )}

        {!loading && !stats && (
          <div className="text-center mt-16">
            <p className="font-heading text-pixel-text-dim text-[10px] mb-6">NO RACES YET!</p>
            <Link href="/play" className="pixel-btn font-heading text-[8px] px-8 py-3 text-pixel-black inline-block animate-pulse-glow">
              START RACING
            </Link>
          </div>
        )}

        {!loading && stats && (
          <>
            {/* Player card */}
            <div className="pixel-panel p-6 mb-6">
              <div className="flex items-start gap-6">
                {/* Bird sprite — clickable to change */}
                <button
                  onClick={() => setShowBirdSelector(!showBirdSelector)}
                  className="flex flex-col items-center group"
                  title="Change bird"
                >
                  <div className={`w-20 h-20 border-2 flex items-center justify-center bg-pixel-navy transition-colors ${showBirdSelector ? "border-pixel-bird-yellow" : "border-pixel-text-dim group-hover:border-pixel-text-white"}`}>
                    <BirdIcon
                      src={`/sprites/${stats.displayBird}.png`}
                      size={56}
                      className="animate-float"
                    />
                  </div>
                  <span className="font-heading text-pixel-text-dim text-[7px] mt-2 group-hover:text-pixel-bird-yellow transition-colors">
                    CHANGE
                  </span>
                </button>

                {/* Player info */}
                <div className="flex-1">
                  <h2 className="font-heading text-pixel-text-white text-xs mb-1">{stats.username}</h2>
                  <p className="font-heading text-[7px] text-pixel-text-dim mb-4">
                    {stats.totalRaces} RACES COMPLETED
                  </p>

                  {/* Stat grid */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-pixel-black p-3">
                      <p className="font-heading text-[6px] text-pixel-text-dim mb-1">BEST WPM</p>
                      <p className="font-heading text-lg text-pixel-text-green text-glow-green">{stats.bestWpm}</p>
                    </div>
                    <div className="bg-pixel-black p-3">
                      <p className="font-heading text-[6px] text-pixel-text-dim mb-1">AVG ACC</p>
                      <p className="font-heading text-lg text-pixel-text-white">{Math.round(stats.avgAccuracy * 100)}%</p>
                    </div>
                    <div className="bg-pixel-black p-3">
                      <p className="font-heading text-[6px] text-pixel-text-dim mb-1">RACES</p>
                      <p className="font-heading text-lg text-pixel-bird-yellow">{stats.totalRaces}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Avatar selector — expandable */}
            {showBirdSelector && (
              <div className="pixel-panel p-6 mb-6 animate-slide-up relative">
                <button
                  onClick={() => setShowBirdSelector(false)}
                  className="absolute top-3 right-4 font-heading text-base text-pixel-text-dim hover:text-pixel-bird-yellow"
                >
                  ✕
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="font-heading text-pixel-bird-yellow text-[9px] text-glow-yellow">
                    CHOOSE YOUR AVATAR
                  </h3>
                  {saving && (
                    <span className="font-heading text-pixel-text-dim text-[7px] animate-pulse">SAVING...</span>
                  )}
                </div>
                <BirdSelector selected={selectedBird} onSelect={saveBird} />
              </div>
            )}

            {/* Game skin selector */}
            <h3 className="font-heading text-pixel-text-dim text-[8px] text-center mb-3 tracking-widest">
              — GAME SKIN —
            </h3>
            <div className="pixel-panel p-4 mb-6">
              <SkinSelector selected={selectedBird} onSelect={saveBird} />
            </div>

            {/* WPM History Chart */}
            {stats.recentRaces.length >= 2 && (
              <>
                <h3 className="font-heading text-pixel-text-dim text-[8px] text-center mb-3 tracking-widest">
                  — WPM HISTORY —
                </h3>
                <WpmChart races={stats.recentRaces} />
              </>
            )}

            {/* Recent races */}
            <h3 className="font-heading text-pixel-text-dim text-[8px] text-center mb-3 tracking-widest">
              — RACE LOG —
            </h3>
            <div className="pixel-panel">
              <div className="grid grid-cols-[1fr_70px_70px] gap-2 px-4 py-3 border-b-2 border-pixel-text-dim">
                <span className="font-heading text-[7px] text-pixel-text-dim">DATE</span>
                <span className="font-heading text-[7px] text-pixel-text-dim text-right">WPM</span>
                <span className="font-heading text-[7px] text-pixel-text-dim text-right">ACC</span>
              </div>
              {stats.recentRaces.map((race, i) => {
                const rowBg = i % 2 === 0 ? "bg-pixel-navy/20" : "";
                return (
                  <div
                    key={i}
                    className={`grid grid-cols-[1fr_70px_70px] gap-2 px-4 py-3 ${rowBg}`}
                  >
                    <span className="text-pixel-text-white text-xs">{new Date(race.createdAt).toLocaleDateString()}</span>
                    <span className="font-heading text-[10px] text-pixel-text-green text-right">{race.wpm}</span>
                    <span className="font-heading text-[10px] text-pixel-text-white text-right">{Math.round(race.accuracy * 100)}%</span>
                  </div>
                );
              })}
              {stats.recentRaces.length === 0 && (
                <div className="p-6 text-center">
                  <span className="font-heading text-pixel-text-dim text-[9px]">NO RECENT RACES</span>
                </div>
              )}
            </div>

            <p className="font-heading text-[6px] text-pixel-text-dim text-center mt-6 animate-blink">
              PRESS PLAY TO RACE AGAIN
            </p>
          </>
        )}
      </div>
    </main>
  );
}
