"use client";

import Link from "next/link";
import { PixelCrown } from "@/components/PixelCrown";
import type { MultiplayerPlayer, Difficulty } from "@/types";

const DIFFICULTIES: Difficulty[] = ["short", "medium", "long"];

interface LobbyWaitingProps {
  roomCode: string;
  players: MultiplayerPlayer[];
  isHost: boolean;
  difficulty: Difficulty;
  onStartRace: () => void;
  onLeaveLobby: () => void;
  onChangeDifficulty?: (difficulty: Difficulty) => void;
  connectionError: string | null;
}

export function LobbyWaiting({
  roomCode,
  players,
  isHost,
  difficulty,
  onStartRace,
  onLeaveLobby,
  onChangeDifficulty,
  connectionError,
}: LobbyWaitingProps) {
  const canStart = isHost && players.filter((p) => p.isConnected).length >= 2;

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {/* Leave lobby */}
      <button
        onClick={onLeaveLobby}
        className="font-heading text-pixel-text-dim text-[10px] hover:text-pixel-text-white self-start"
      >
        ← LEAVE
      </button>

      {/* Room code display */}
      <div className="text-center">
        <p className="font-body text-pixel-text-dim text-sm uppercase tracking-widest">
          Room Code
        </p>
        <p className="font-heading text-pixel-text-white text-4xl tracking-[0.3em] mt-2">
          {roomCode}
        </p>
        <button
          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/lobby/${roomCode}`)}
          className="font-body text-pixel-bird-blue text-sm mt-2 hover:underline"
        >
          Copy invite link
        </button>
      </div>

      {/* Difficulty selector (host) or badge (non-host) */}
      {isHost && onChangeDifficulty ? (
        <div className="flex gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => onChangeDifficulty(d)}
              className={`font-heading text-[10px] px-4 py-2 rounded transition-colors ${
                difficulty === d
                  ? "bg-pixel-bird-blue text-pixel-black"
                  : "bg-pixel-panel text-pixel-text-dim hover:text-pixel-text-white"
              }`}
            >
              {d.toUpperCase()}
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-pixel-panel rounded px-4 py-2">
          <span className="font-body text-pixel-text-dim text-sm">Difficulty: </span>
          <span className="font-heading text-pixel-text-white text-sm uppercase">
            {difficulty}
          </span>
        </div>
      )}

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
              <div
                className="w-8 h-8 [image-rendering:pixelated] overflow-hidden flex-shrink-0"
              >
                <img
                  src={`/sprites/${player.displayBird}.png`}
                  alt={player.displayBird}
                  className="h-full [image-rendering:pixelated]"
                  style={{ objectFit: "cover", objectPosition: "0 0", width: "auto" }}
                />
              </div>
              <span className="font-body text-pixel-text-white flex-1">
                {player.username}
              </span>
              {player.isHost && <PixelCrown size={14} />}
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
