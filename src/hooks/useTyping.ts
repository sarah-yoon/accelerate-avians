import { useRef, useCallback, useState, useEffect } from "react";
import { TypingEngine } from "@/components/typing/typing-engine";
import type { GhostDataPoint } from "@/types";

interface UseTypingReturn {
  cursorPos: number;
  hasError: boolean;
  isComplete: boolean;
  wpm: number;
  accuracy: number;
  clientGhostData: GhostDataPoint[];
  totalKeystrokes: number;
  correctKeystrokes: number;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleCompositionStart: () => void;
  handleCompositionEnd: () => void;
  reset: (newPassage: string) => void;
}

/**
 * Optional per-keystroke callback. Fires after each accepted keypress with
 * the classification the `useCombo` reducer consumes (§ 3.5).
 *   - "correct"   → cursor advanced, correctKeystrokes incremented
 *   - "incorrect" → error recorded, cursor stayed
 *
 * Backspace isn't currently handled by TypingEngine so it never fires here.
 */
export type KeystrokeEvent =
  | { kind: "correct"; charIndex: number }
  | { kind: "incorrect"; charIndex: number };

export function useTyping(
  passage: string,
  raceStartTime: number | null,
  enabled: boolean,
  reconnectCharIndex?: number,
  onKeystroke?: (event: KeystrokeEvent) => void
): UseTypingReturn {
  const engineRef = useRef<TypingEngine>(new TypingEngine(passage));
  const [cursorPos, setCursorPos] = useState(0);
  const [hasError, setHasError] = useState(false);

  // When resuming after reconnect, advance the internal cursor to the server's
  // authoritative charIndex so the next keystroke passes the monotonic validator.
  useEffect(() => {
    if (reconnectCharIndex != null && reconnectCharIndex > 0) {
      engineRef.current.resumeFrom(reconnectCharIndex);
      setCursorPos(reconnectCharIndex);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconnectCharIndex]);
  const [isComplete, setIsComplete] = useState(false);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [clientGhostData, setClientGhostData] = useState<GhostDataPoint[]>([]);
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [correctKeystrokes, setCorrectKeystrokes] = useState(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || !raceStartTime) return;

      // Ignore modifier keys, function keys, etc.
      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;

      e.preventDefault();

      const engine = engineRef.current;
      const now = performance.now();
      const elapsed = now - raceStartTime;

      const correctBefore = engine.correctKeystrokes;
      const cursorBefore = engine.cursorPos;
      engine.handleKey(e.key, elapsed);
      const advanced = engine.correctKeystrokes > correctBefore;

      if (onKeystroke) {
        onKeystroke(
          advanced
            ? { kind: "correct", charIndex: engine.cursorPos }
            : { kind: "incorrect", charIndex: cursorBefore }
        );
      }

      setCursorPos(engine.cursorPos);
      setHasError(engine.hasError);
      setIsComplete(engine.isComplete);
      setWpm(engine.getCurrentWpm(elapsed));
      setAccuracy(engine.getAccuracy());
      setClientGhostData([...engine.clientGhostData]);
      setTotalKeystrokes(engine.totalKeystrokes);
      setCorrectKeystrokes(engine.correctKeystrokes);
    },
    [enabled, raceStartTime, onKeystroke]
  );

  const handleCompositionStart = useCallback(() => {
    engineRef.current.setComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    engineRef.current.setComposing(false);
  }, []);

  const reset = useCallback((newPassage: string) => {
    engineRef.current = new TypingEngine(newPassage);
    setCursorPos(0);
    setHasError(false);
    setIsComplete(false);
    setWpm(0);
    setAccuracy(0);
    setClientGhostData([]);
    setTotalKeystrokes(0);
    setCorrectKeystrokes(0);
  }, []);

  return {
    cursorPos,
    hasError,
    isComplete,
    wpm,
    accuracy,
    clientGhostData,
    totalKeystrokes,
    correctKeystrokes,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
    reset,
  };
}
