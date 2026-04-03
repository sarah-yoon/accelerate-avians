"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useSocket } from "@/hooks/useSocket";
import { useMultiplayerRace } from "@/hooks/useMultiplayerRace";
import { LobbyWaiting } from "@/components/lobby/LobbyWaiting";
import { LobbyRace } from "@/components/lobby/LobbyRace";
import { LobbyResults } from "@/components/lobby/LobbyResults";

interface LobbyClientProps {
  roomCode: string;
}

export function LobbyClient({ roomCode }: LobbyClientProps) {
  const { user } = useUser();
  const { socket, status, error: socketError } = useSocket();
  const race = useMultiplayerRace(socket);

  // Auto-join the room when socket connects
  useEffect(() => {
    if (socket && status === "connected" && !race.roomCode) {
      race.joinRoom(roomCode);
    }
  }, [socket, status, roomCode, race.roomCode, race.joinRoom]);

  // Connection states
  if (status === "connecting") {
    return (
      <div className="min-h-screen bg-pixel-black flex items-center justify-center">
        <p className="font-heading text-pixel-text-dim text-sm animate-pulse">
          CONNECTING...
        </p>
      </div>
    );
  }

  if (status === "reconnecting") {
    return (
      <div className="min-h-screen bg-pixel-black flex items-center justify-center">
        <p className="font-heading text-pixel-bird-yellow text-sm animate-pulse">
          RECONNECTING...
        </p>
      </div>
    );
  }

  if (status === "disconnected" && socketError) {
    return (
      <div className="min-h-screen bg-pixel-black flex flex-col items-center justify-center gap-4">
        <p className="font-heading text-pixel-bird-red text-sm">
          CONNECTION LOST
        </p>
        <p className="font-body text-pixel-text-dim text-sm">{socketError}</p>
        <a
          href="/"
          className="font-heading text-sm text-pixel-bird-blue hover:underline mt-4"
        >
          BACK TO HOME
        </a>
      </div>
    );
  }

  // Room error (invalid code, etc.)
  if (race.connectionError && !race.roomCode) {
    return (
      <div className="min-h-screen bg-pixel-black flex flex-col items-center justify-center gap-4">
        <p className="font-heading text-pixel-bird-red text-sm">
          {race.connectionError}
        </p>
        <a
          href="/"
          className="font-heading text-sm text-pixel-bird-blue hover:underline mt-4"
        >
          BACK TO HOME
        </a>
      </div>
    );
  }

  const currentUserId = race.myUserId ?? "";

  return (
    <main className="hidden md:flex flex-col items-center min-h-screen bg-pixel-black p-6">
      {/* Game HUD header — same as solo */}
      <div className="w-full max-w-[900px] game-hud flex justify-between items-center px-4 py-3 mb-6">
        <Link href="/" className="game-menu-item !p-0 !pl-5 text-[8px]">
          HOME
        </Link>
        <span className="font-heading text-pixel-bird-yellow text-[9px] text-glow-yellow">
          {race.roomCode ? `ROOM: ${race.roomCode}` : "MULTIPLAYER"}
        </span>
        <div>
          {user ? (
            <Link href="/profile" className="game-menu-item !p-0 !pl-5 text-[8px]">
              PROFILE
            </Link>
          ) : (
            <Link href="/sign-in" className="game-menu-item !p-0 !pl-5 text-[8px]">
              SIGN IN
            </Link>
          )}
        </div>
      </div>

      <div className="w-full max-w-[900px]">
      {race.lobbyPhase === "waiting" && race.roomCode && (
        <LobbyWaiting
          roomCode={race.roomCode}
          players={race.players}
          isHost={race.isHost}
          difficulty={race.difficulty}
          onStartRace={race.startRace}
          connectionError={race.connectionError}
        />
      )}

      {(race.lobbyPhase === "countdown" || race.lobbyPhase === "racing") &&
        race.passage && (
          <LobbyRace
            passage={race.passage}
            players={race.players}
            currentUserId={currentUserId}
            playerProgresses={race.playerProgresses}
            countdownValue={race.countdownValue}
            racePhase={race.lobbyPhase === "countdown" ? "countdown" : "racing"}
            raceStartedAt={race.raceStartedAt}
            reconnectCharIndex={race.reconnectCharIndex}
            onProgress={race.sendProgress}
            onFinished={race.sendFinished}
          />
        )}

      {race.lobbyPhase === "results" && race.rankings && race.roomCode && (
        <LobbyResults
          rankings={race.rankings}
          currentUserId={currentUserId}
          roomCode={race.roomCode}
        />
      )}
      </div>
    </main>
  );
}
