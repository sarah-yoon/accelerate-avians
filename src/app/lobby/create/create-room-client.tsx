"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import type { Difficulty } from "@/types";

export function CreateRoomClient() {
  const router = useRouter();
  const { socket, status } = useSocket();
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!socket) return;

    function onRoomCreated({ roomCode }: { roomCode: string }) {
      router.push(`/lobby/${roomCode}`);
    }

    socket.on("room-created", onRoomCreated);
    return () => {
      socket.off("room-created", onRoomCreated);
    };
  }, [socket, router]);

  function handleCreate() {
    if (!socket || isCreating) return;
    setIsCreating(true);
    socket.emit("create-room", { difficulty });
  }

  if (status === "connecting") {
    return (
      <main className="min-h-screen bg-pixel-black flex items-center justify-center">
        <p className="font-heading text-pixel-text-dim text-sm animate-pulse">
          CONNECTING...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-pixel-black flex flex-col items-center justify-center gap-8">
      <h1 className="font-heading text-pixel-text-white text-lg">
        CREATE ROOM
      </h1>

      {/* Difficulty selector */}
      <div className="flex gap-3">
        {(["short", "medium", "long"] as Difficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            className={`font-heading text-sm px-6 py-3 rounded transition-colors ${
              difficulty === d
                ? "bg-pixel-bird-blue text-pixel-black"
                : "bg-pixel-panel text-pixel-text-dim hover:text-pixel-text-white"
            }`}
          >
            {d.toUpperCase()}
          </button>
        ))}
      </div>

      <button
        onClick={handleCreate}
        disabled={isCreating || status !== "connected"}
        className="font-heading text-sm bg-pixel-text-green text-pixel-black px-10 py-4 rounded hover:bg-pixel-grass transition-colors disabled:bg-pixel-text-dim disabled:cursor-not-allowed"
      >
        {isCreating ? "CREATING..." : "CREATE & JOIN"}
      </button>
    </main>
  );
}
