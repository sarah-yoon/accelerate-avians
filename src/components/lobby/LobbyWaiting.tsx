"use client";

import type { MultiplayerPlayer, Difficulty } from "@/types";

interface LobbyWaitingProps {
  roomCode: string;
  players: MultiplayerPlayer[];
  isHost: boolean;
  difficulty: Difficulty;
  onStartRace: () => void;
  connectionError: string | null;
}

export function LobbyWaiting({
  roomCode,
  players,
  isHost,
  difficulty,
  onStartRace,
  connectionError,
}: LobbyWaitingProps) {
  const canStart = isHost && players.filter((p) => p.isConnected).length >= 2;

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {/* Room code display */}
      <div className="text-center">
        <p className="font-body text-pixel-text-dim text-sm uppercase tracking-widest">
          Room Code
        </p>
        <p className="font-heading text-pixel-text-white text-4xl tracking-[0.3em] mt-2">
          {roomCode}
        </p>
        <button
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          className="font-body text-pixel-bird-blue text-sm mt-2 hover:underline"
        >
          Copy invite link
        </button>
      </div>

      {/* Difficulty badge */}
      <div className="bg-pixel-panel rounded px-4 py-2">
        <span className="font-body text-pixel-text-dim text-sm">Difficulty: </span>
        <span className="font-heading text-pixel-text-white text-sm uppercase">
          {difficulty}
        </span>
      </div>

      {/* Player list */}
      <div className="w-full max-w-sm">
        <p className="font-heading text-pixel-text-white text-xs mb-3">
          Players ({players.length}/6)
        </p>
        <ul className="space-y-2">
          {players.map((player) => (
            <li
              key={player.userId}
              className="flex items-center gap-3 bg-pixel-panel rounded px-4 py-3"
            >
              <img
                src={`/sprites/${player.displayBird}.png`}
                alt={player.displayBird}
                className="w-8 h-8 [image-rendering:pixelated]"
                style={{ objectFit: "none", objectPosition: "0 0" }}
              />
              <span className="font-body text-pixel-text-white flex-1">
                {player.username}
              </span>
              {player.isHost && (
                <span className="font-heading text-pixel-bird-yellow text-[10px]">
                  HOST
                </span>
              )}
              {!player.isConnected && (
                <span className="font-heading text-pixel-text-dim text-[10px]">
                  DISCONNECTED
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Start button (host only) */}
      {isHost && (
        <button
          onClick={onStartRace}
          disabled={!canStart}
          className={`font-heading text-sm px-8 py-3 rounded transition-colors ${
            canStart
              ? "bg-pixel-text-green text-pixel-black hover:bg-pixel-grass"
              : "bg-pixel-text-dim text-pixel-panel cursor-not-allowed"
          }`}
        >
          {canStart ? "START RACE" : "NEED 2+ PLAYERS"}
        </button>
      )}

      {!isHost && (
        <p className="font-body text-pixel-text-dim text-sm">
          Waiting for host to start the race...
        </p>
      )}

      {/* Error display */}
      {connectionError && (
        <div className="bg-pixel-bird-red/20 border border-pixel-bird-red rounded px-4 py-2">
          <p className="font-body text-pixel-bird-red text-sm">{connectionError}</p>
        </div>
      )}
    </div>
  );
}
