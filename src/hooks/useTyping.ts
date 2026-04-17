import { useRef, useCallback, useState } from "react";
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

export function useTyping(
  passage: string,
  raceStartTime: number | null,
  enabled: boolean
): UseTypingReturn {
  const engineRef = useRef<TypingEngine>(new TypingEngine(passage));
  const [cursorPos, setCursorPos] = useState(0);
  const [hasError, setHasError] = useState(false);
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

      engine.handleKey(e.key, elapsed);

      setCursorPos(engine.cursorPos);
      setHasError(engine.hasError);
      setIsComplete(engine.isComplete);
      setWpm(engine.getCurrentWpm(elapsed));
      setAccuracy(engine.getAccuracy());
      setClientGhostData([...engine.clientGhostData]);
      setTotalKeystrokes(engine.totalKeystrokes);
      setCorrectKeystrokes(engine.correctKeystrokes);
    },
    [enabled, raceStartTime]
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
