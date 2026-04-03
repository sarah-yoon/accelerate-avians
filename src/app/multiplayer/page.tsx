"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MultiplayerPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code) {
      router.push(`/lobby/${code}`);
    }
  }

  return (
    <main className="game-screen relative overflow-hidden">
      <div className="relative z-10 flex flex-col items-center gap-8">
        <Link
          href="/"
          className="font-heading text-pixel-text-dim text-[10px] hover:text-pixel-text-white self-start"
        >
          ← BACK
        </Link>

        <h1 className="font-heading text-pixel-text-white text-lg">
          MULTIPLAYER
        </h1>

        {/* Create room */}
        <Link
          href="/lobby/create"
          className="font-heading text-sm bg-pixel-text-green text-pixel-black px-10 py-4 rounded hover:bg-pixel-grass transition-colors text-center"
        >
          CREATE ROOM
        </Link>

        <div className="game-divider w-32" />

        {/* Join room */}
        <form onSubmit={handleJoin} className="flex flex-col items-center gap-3">
          <p className="font-heading text-pixel-text-dim text-[10px]">
            OR JOIN WITH CODE
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ROBIN-42"
              className="font-heading text-sm bg-pixel-panel text-pixel-text-white px-4 py-3 rounded uppercase tracking-widest w-40 text-center placeholder:text-pixel-text-dim border-2 border-pixel-text-dim focus:border-pixel-bird-yellow outline-none"
            />
            <button
              type="submit"
              disabled={!roomCode.trim()}
              className="font-heading text-sm bg-pixel-bird-blue text-pixel-black px-6 py-3 rounded hover:bg-pixel-bird-blue/80 transition-colors disabled:bg-pixel-text-dim disabled:cursor-not-allowed"
            >
              JOIN
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
