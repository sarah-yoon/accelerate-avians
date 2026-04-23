"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTyping } from "./useTyping";
import { useCombo, type ComboState } from "./useCombo";
import type { Passage, GhostRacer, RaceResult, RacePhase } from "@/types";

interface UseRaceReturn {
  phase: RacePhase;
  countdownValue: number | "GO";
  passage: Passage | null;
  ghosts: GhostRacer[];
  playerProgress: number;
  cursorPos: number;
  hasError: boolean;
  wpm: number;
  accuracy: number;
  result: RaceResult | null;
  isLoading: boolean;
  raceStartTime: number | null;
  elapsedMs: number;
  comboState: ComboState;
  /** Increments every time the player's cursor crosses a space — drives word-flash juice. */
  wordsCompleted: number;
  startRace: (difficulty?: string, samePassage?: boolean, botDifficulty?: string) => Promise<void>;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleCompositionStart: () => void;
  handleCompositionEnd: () => void;
}

export function useRace(clerkId?: string): UseRaceReturn {
  const [phase, setPhase] = useState<RacePhase>("idle");
  const [countdownValue, setCountdownValue] = useState<number | "GO">(3);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [ghosts, setGhosts] = useState<GhostRacer[]>([]);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [raceStartTime, setRaceStartTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const countdownTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const elapsedFrameRef = useRef<number>(0);

  const combo = useCombo();
  const comboRecord = combo.record;
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const prevCursorRef = useRef(0);

  const typing = useTyping(
    passage?.text ?? "",
    raceStartTime,
    phase === "racing",
    undefined,
    comboRecord
  );

  const playerProgress = passage
    ? typing.cursorPos / passage.charCount
    : 0;

  // Word-boundary detector: every time the cursor advances across a space
  // (or hits end-of-passage), bump a counter. RaceCanvas watches this for
  // the word-flash juice (§ 3.1). Reset to 0 when a new passage loads.
  useEffect(() => {
    if (phase !== "racing" || !passage) return;
    const prev = prevCursorRef.current;
    const cur = typing.cursorPos;
    if (cur > prev) {
      let crossed = 0;
      for (let i = prev; i < cur; i++) {
        if (passage.text[i] === " ") crossed++;
      }
      if (cur >= passage.charCount && passage.text[passage.charCount - 1] !== " ") {
        crossed++; // final word doesn't end with a space
      }
      if (crossed > 0) {
        setWordsCompleted((n) => n + crossed);
      }
    }
    prevCursorRef.current = cur;
  }, [typing.cursorPos, phase, passage]);

  // Watch for race completion
  const typingComplete = typing.isComplete;
  const typingWpm = typing.wpm;
  const typingAccuracy = typing.accuracy;
  const typingGhostData = typing.clientGhostData;
  const typingTotalKeystrokes = typing.totalKeystrokes;
  const typingCorrectKeystrokes = typing.correctKeystrokes;

  useEffect(() => {
    if (typingComplete && phase === "racing" && passage) {
      setPhase("finished");

      // Calculate placement vs ghosts
      const ghostFinishTimes = ghosts.map((g) => {
        const lastPoint = g.clientGhostData[g.clientGhostData.length - 1];
        return lastPoint?.ms ?? Infinity;
      });
      const playerTime =
        typingGhostData[typingGhostData.length - 1]?.ms ?? Infinity;
      const beaten = ghostFinishTimes.filter((t) => playerTime < t).length;
      const placement = ghosts.length + 1 - beaten;

      const raceResult: RaceResult = {
        wpm: typingWpm,
        accuracy: typingAccuracy,
        placement,
        totalRacers: ghosts.length + 1,
        isPersonalBest: false, // Server will determine this
      };
      setResult(raceResult);

      // Submit score if authenticated
      if (clerkId) {
        fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passageId: passage.id,
            clientGhostData: typingGhostData,
            totalKeystrokes: typingTotalKeystrokes,
            correctKeystrokes: typingCorrectKeystrokes,
          }),
        }).catch(console.error);
      }
    }
  }, [typingComplete, phase, passage, ghosts, clerkId, typingWpm, typingAccuracy, typingGhostData, typingTotalKeystrokes, typingCorrectKeystrokes]);

  const startRace = useCallback(
    async (difficulty?: string, samePassage?: boolean, botDifficulty?: string) => {
      // Clear any existing countdown timers
      countdownTimersRef.current.forEach(clearTimeout);
      countdownTimersRef.current = [];

      setIsLoading(true);
      setResult(null);
      setPhase("idle");
      setRaceStartTime(null);

      try {
        let passageData: Passage;

        if (samePassage && passage) {
          passageData = passage;
        } else {
          // Fetch random passage
          const passageUrl = difficulty
            ? `/api/passages/random?difficulty=${difficulty}`
            : "/api/passages/random";
          const passageRes = await fetch(passageUrl);
          if (!passageRes.ok) throw new Error("Failed to fetch passage");
          passageData = await passageRes.json();
          setPassage(passageData);
        }

        // Fetch ghosts with optional bot difficulty filter
        const ghostParams = new URLSearchParams();
        if (clerkId) ghostParams.set("clerkId", clerkId);
        if (botDifficulty) ghostParams.set("botDifficulty", botDifficulty);
        const ghostQuery = ghostParams.toString();
        const ghostUrl = `/api/passages/${passageData.id}/ghosts${ghostQuery ? `?${ghostQuery}` : ""}`;
        const ghostRes = await fetch(ghostUrl);
        const ghostData = await ghostRes.json();
        setGhosts(ghostData.ghosts || []);

        // Reset typing engine + combo meter + word counter
        typing.reset(passageData.text);
        comboRecord({ kind: "reset" });
        setWordsCompleted(0);
        prevCursorRef.current = 0;

        setIsLoading(false);

        // Start countdown
        setPhase("countdown");
        setCountdownValue(3);

        const countdownSequence = [
          { value: 2 as number | "GO", delay: 1000 },
          { value: 1 as number | "GO", delay: 2000 },
          { value: "GO" as number | "GO", delay: 3000 },
        ];

        for (const step of countdownSequence) {
          const timerId = setTimeout(() => {
            setCountdownValue(step.value);
          }, step.delay);
          countdownTimersRef.current.push(timerId);
        }

        // Start race after countdown
        const raceTimerId = setTimeout(() => {
          setRaceStartTime(performance.now());
          setPhase("racing");
        }, 3500);
        countdownTimersRef.current.push(raceTimerId);
      } catch (error) {
        console.error("Failed to start race:", error);
        setIsLoading(false);
      }
    },
    [clerkId, typing, passage, comboRecord]
  );

  // Update elapsedMs during racing
  useEffect(() => {
    if (phase !== "racing" || !raceStartTime) return;
    const tick = () => {
      setElapsedMs(performance.now() - raceStartTime);
      elapsedFrameRef.current = requestAnimationFrame(tick);
    };
    elapsedFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(elapsedFrameRef.current);
  }, [phase, raceStartTime]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      countdownTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  return {
    phase,
    countdownValue,
    passage,
    ghosts,
    playerProgress,
    cursorPos: typing.cursorPos,
    hasError: typing.hasError,
    wpm: typing.wpm,
    accuracy: typing.accuracy,
    result,
    isLoading,
    raceStartTime,
    elapsedMs,
    comboState: combo.state,
    wordsCompleted,
    startRace,
    handleKeyDown: typing.handleKeyDown,
    handleCompositionStart: typing.handleCompositionStart,
    handleCompositionEnd: typing.handleCompositionEnd,
  };
}
