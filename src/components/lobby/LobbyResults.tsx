"use client";

import type { MultiplayerRanking } from "@/types";

interface LobbyResultsProps {
  rankings: MultiplayerRanking[];
  currentUserId: string;
  roomCode: string;
}

export function LobbyResults({
  rankings,
  currentUserId,
  roomCode,
}: LobbyResultsProps) {
  const myResult = rankings.find((r) => r.userId === currentUserId);

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {/* Placement header */}
      {myResult && (
        <div className="text-center">
          <p className="font-heading text-pixel-text-dim text-sm">YOU PLACED</p>
          <p
            className={`font-heading text-6xl mt-2 ${
              myResult.placement === 1
                ? "text-pixel-bird-yellow"
                : myResult.placement === 2
                ? "text-pixel-text-white"
                : myResult.placement === 3
                ? "text-pixel-bird-orange"
                : "text-pixel-text-dim"
            }`}
          >
            {myResult.status === "dnf" ? "DNF" : `#${myResult.placement}`}
          </p>
          {myResult.wpm !== null && (
            <p className="font-body text-pixel-text-green text-lg mt-1">
              {myResult.wpm} WPM
            </p>
          )}
        </div>
      )}

      {/* Full rankings table */}
      <div className="w-full max-w-md">
        <table className="w-full">
          <thead>
            <tr className="font-heading text-pixel-text-dim text-[10px] uppercase">
              <th className="text-left py-2 px-3">#</th>
              <th className="text-left py-2 px-3">Player</th>
              <th className="text-right py-2 px-3">WPM</th>
              <th className="text-right py-2 px-3">ACC</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((ranking) => {
              const isMe = ranking.userId === currentUserId;
              return (
                <tr
                  key={ranking.userId}
                  className={`border-t border-pixel-panel ${
                    isMe ? "bg-pixel-panel" : ""
                  }`}
                >
                  <td className="py-3 px-3">
                    <span
                      className={`font-heading text-sm ${
                        ranking.placement === 1
                          ? "text-pixel-bird-yellow"
                          : "text-pixel-text-white"
                      }`}
                    >
                      {ranking.status === "dnf" ? "DNF" : ranking.placement}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 overflow-hidden flex-shrink-0">
                        <img
                          src={`/sprites/${ranking.displayBird}.png`}
                          alt={ranking.displayBird}
                          className="h-full [image-rendering:pixelated]"
                          style={{ objectFit: "cover", objectPosition: "0 0", width: "auto" }}
                        />
                      </div>
                      <span className="font-body text-pixel-text-white text-sm">
                        {ranking.username}
                        {isMe && (
                          <span className="text-pixel-text-dim ml-1">(you)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="font-heading text-pixel-text-green text-sm">
                      {ranking.wpm !== null ? ranking.wpm : "--"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="font-body text-pixel-text-white text-sm">
                      {ranking.accuracy !== null
                        ? `${Math.round(ranking.accuracy * 100)}%`
                        : "--"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <a
          href="/"
          className="font-heading text-sm text-pixel-text-dim hover:text-pixel-text-white px-6 py-2 border border-pixel-text-dim rounded transition-colors"
        >
          HOME
        </a>
      </div>
    </div>
  );
}
