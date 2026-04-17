import type { GhostDataPoint } from "@/types";

export function computeWpm(wordCount: number, totalTimeMs: number): number {
  if (totalTimeMs === 0) return 0;
  return Math.round((wordCount / totalTimeMs) * 60000);
}

export function computeAccuracy(
  correctKeystrokes: number,
  totalKeystrokes: number
): number {
  if (totalKeystrokes === 0) return 0;
  return correctKeystrokes / totalKeystrokes;
}

interface ValidateScoreInput {
  clientGhostData: GhostDataPoint[];
  wordCount: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
}

type ValidationResult =
  | { valid: true; wpm: number; accuracy: number }
  | { valid: false; reason: string };

export function validateScore(input: ValidateScoreInput): ValidationResult {
  const { clientGhostData, wordCount, totalKeystrokes, correctKeystrokes } = input;

  if (clientGhostData.length < 10) {
    return { valid: false, reason: "clientGhostData must have at least 10 entries" };
  }

  const totalTimeMs = clientGhostData[clientGhostData.length - 1].ms;
  const wpm = computeWpm(wordCount, totalTimeMs);
  const accuracy = computeAccuracy(correctKeystrokes, totalKeystrokes);

  if (wpm > 250) {
    return { valid: false, reason: "WPM exceeds maximum of 250" };
  }

  if (wpm < 25) {
    return { valid: false, reason: "WPM below minimum of 25" };
  }

  return { valid: true, wpm, accuracy };
}
