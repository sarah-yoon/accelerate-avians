"use client";

import { useEffect, useRef } from "react";
import { RaceCanvas } from "@/components/race/RaceCanvas";
import { TypingArea } from "@/components/typing/TypingArea";
import { useTyping } from "@/hooks/useTyping";
import type { MultiplayerPlayer, GhostRacer } from "@/types";

interface LobbyRaceProps {
  passage: {
    id: string;
    text: string;
    charCount: number;
    wordCount: number;
  };
  players: MultiplayerPlayer[];
  currentUserId: string;
  playerProgresses: { [userId: string]: number };
  countdownValue: number | "GO";
  racePhase: "countdown" | "racing";
  raceStartedAt: number | null;
  reconnectCharIndex: number | null;
  onProgress: (charIndex: number) => void;
  onFinished: (ghostData: Array<{ charIndex: number; ms: number }>, correctKeystrokes: number, totalKeystrokes: number) => void;
}

export function LobbyRace({
  passage,
  players,
  currentUserId,
  playerProgresses,
  countdownValue,
  racePhase,
  raceStartedAt,
  reconnectCharIndex,
  onProgress,
  onFinished,
}: LobbyRaceProps) {
  const hasFinishedRef = useRef(false);

  const {
    cursorPos,
    hasError,
    wpm,
    accuracy,
    ghostData,
    correctKeystrokes,
    totalKeystrokes,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
  } = useTyping(passage.text, racePhase === "racing" ? raceStartedAt : null, racePhase === "racing");

  // Send progress updates to server
  useEffect(() => {
    if (racePhase !== "racing") return;
    onProgress(cursorPos);
  }, [cursorPos, racePhase, onProgress]);

  // Detect race completion
  useEffect(() => {
    if (
      racePhase === "racing" &&
      cursorPos >= passage.charCount &&
      !hasFinishedRef.current
    ) {
      hasFinishedRef.current = true;
      onFinished(ghostData, correctKeystrokes, totalKeystrokes);
    }
  }, [cursorPos, passage.charCount, racePhase, ghostData, correctKeystrokes, totalKeystrokes, onFinished]);

  // Convert multiplayer players to GhostRacer format for the Canvas
  const currentPlayer = players.find((p) => p.userId === currentUserId);
  const playerBird = currentPlayer?.displayBird ?? "robin";
  const playerUsername = currentPlayer?.username ?? "You";

  // Build ghost racers from other players' progress
  const ghosts: GhostRacer[] = players
    .filter((p) => p.userId !== currentUserId)
    .map((p) => {
      const progress = playerProgresses[p.userId] ?? 0;
      return {
        id: p.userId,
        username: p.username,
        displayBird: p.displayBird,
        wpm: 0,
        ghostData: [],
        isPersonalBest: false,
        _liveProgress: progress,
      } as GhostRacer & { _liveProgress: number };
    });

  const playerProgress = passage.charCount > 0 ? cursorPos / passage.charCount : 0;
  const elapsedMs = raceStartedAt ? Date.now() - raceStartedAt : 0;

  return (
    <div className="flex flex-col items-center gap-4 p-4 w-full">
      {/* Race canvas */}
      <RaceCanvas
        phase={racePhase === "countdown" ? "countdown" : "racing"}
        countdownValue={countdownValue}
        playerProgress={playerProgress}
        playerBird={playerBird}
        playerUsername={playerUsername}
        ghosts={ghosts}
        totalChars={passage.charCount}
        raceStartTime={raceStartedAt}
        wpm={wpm}
      />

      {/* Typing area */}
      <TypingArea
        passage={passage.text}
        cursorPos={cursorPos}
        hasError={hasError}
        wpm={wpm}
        accuracy={accuracy}
        elapsedMs={elapsedMs}
        enabled={racePhase === "racing"}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
      />
    </div>
  );
}
