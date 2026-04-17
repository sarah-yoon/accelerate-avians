"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { AfkBubble } from "@/components/AfkBubble";
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
  onFinished: (clientGhostData: Array<{ charIndex: number; ms: number }>, correctKeystrokes: number, totalKeystrokes: number) => void;
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
  const [playerFinished, setPlayerFinished] = useState(false);
  const [finalWpm, setFinalWpm] = useState(0);
  const [finalAccuracy, setFinalAccuracy] = useState(0);

  const {
    cursorPos,
    hasError,
    wpm,
    accuracy,
    clientGhostData,
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
      setFinalWpm(wpm);
      setFinalAccuracy(accuracy);
      setPlayerFinished(true);
      onFinished(clientGhostData, correctKeystrokes, totalKeystrokes);
    }
  }, [cursorPos, passage.charCount, racePhase, clientGhostData, correctKeystrokes, totalKeystrokes, onFinished]);

  // Convert multiplayer players to GhostRacer format for the Canvas
  const currentPlayer = players.find((p) => p.userId === currentUserId);
  const playerBird = currentPlayer?.displayBird ?? "robin";
  const playerUsername = currentPlayer?.username ?? "You";

  // Track AFK players (no progress for 30s)
  const lastProgressRef = useRef<Record<string, { progress: number; time: number }>>({});
  const [afkPlayerIds, setAfkPlayerIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (racePhase !== "racing") return;
    const now = Date.now();
    for (const [userId, progress] of Object.entries(playerProgresses)) {
      const prev = lastProgressRef.current[userId];
      if (!prev || prev.progress !== progress) {
        lastProgressRef.current[userId] = { progress, time: now };
      }
    }
  }, [playerProgresses, racePhase]);

  useEffect(() => {
    if (racePhase !== "racing") return;
    const interval = setInterval(() => {
      const now = Date.now();
      const afk = new Set<string>();
      for (const [userId, data] of Object.entries(lastProgressRef.current)) {
        if (now - data.time > 30_000) {
          afk.add(userId);
        }
      }
      setAfkPlayerIds(afk);
    }, 5000);
    return () => clearInterval(interval);
  }, [racePhase]);

  // Memoize other players list so it only changes when players join/leave
  const otherPlayers = useMemo(
    () => players.filter((p) => p.userId !== currentUserId),
    [players.length, currentUserId]
  );

  // Build ghost racers — memoize the base array, update progress via ref
  const ghosts: GhostRacer[] = otherPlayers.map((p) => {
    const progress = playerProgresses[p.userId] ?? 0;
    return {
      id: p.userId,
      username: p.username,
      displayBird: p.displayBird,
      wpm: 0,
      clientGhostData: [],
      isPersonalBest: false,
      _liveProgress: progress,
    } as GhostRacer & { _liveProgress: number };
  });

  // Determine canvas phase — show "finished" when player completes to trigger confetti
  const playerProgress = passage.charCount > 0 ? cursorPos / passage.charCount : 0;
  const elapsedMs = raceStartedAt ? performance.now() - raceStartedAt : 0;

  // Deterministic seed from passage ID so all players see the same background
  const backgroundSeed = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < passage.id.length; i++) {
      hash = ((hash << 5) - hash + passage.id.charCodeAt(i)) | 0;
    }
    return hash;
  }, [passage.id]);

  return (
    <div className="w-full max-w-[900px]">
      {/* Canvas + overlay container */}
      <div className="mb-4 relative">
        <RaceCanvas
          phase={playerFinished ? "finished" : racePhase === "countdown" ? "countdown" : "racing"}
          countdownValue={countdownValue}
          playerProgress={playerProgress}
          playerBird={playerBird}
          playerUsername={playerUsername}
          ghosts={ghosts}
          totalChars={passage.charCount}
          raceStartTime={raceStartedAt}
          wpm={wpm}
          backgroundSeed={backgroundSeed}
        />
      </div>

      {/* Typing area or finished state */}
      {playerFinished ? (
        <div className="pixel-panel p-6 mb-4 text-center">
          <p className="font-heading text-pixel-bird-yellow text-sm mb-3">
            RACE COMPLETE!
          </p>
          <div className="flex justify-center gap-8 mb-4">
            <div>
              <p className="font-heading text-pixel-text-green text-2xl">{finalWpm}</p>
              <p className="font-heading text-pixel-text-dim text-[8px]">WPM</p>
            </div>
            <div>
              <p className="font-heading text-pixel-text-white text-2xl">
                {Math.round(finalAccuracy * 100)}%
              </p>
              <p className="font-heading text-pixel-text-dim text-[8px]">ACC</p>
            </div>
          </div>
          {afkPlayerIds.size > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <AfkBubble />
              <p className="font-heading text-pixel-text-dim text-[8px]">
                {otherPlayers
                  .filter((p) => afkPlayerIds.has(p.userId))
                  .map((p) => p.username)
                  .join(", ")}{" "}
                AFK
              </p>
            </div>
          )}
          <p className="font-heading text-pixel-text-dim text-[8px] animate-pulse">
            WAITING FOR OTHER PLAYERS...
          </p>
        </div>
      ) : (
        <div className="pixel-panel p-4 mb-4">
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
      )}
    </div>
  );
}
