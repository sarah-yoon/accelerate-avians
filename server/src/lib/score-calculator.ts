interface GhostDataPoint {
  charIndex: number;
  ms: number;
}

interface RaceResult {
  wpm: number;
  accuracy: number;
}

export function calculateResults(
  ghostData: GhostDataPoint[],
  wordCount: number,
  correctKeystrokes: number,
  totalKeystrokes: number
): RaceResult {
  // WPM calculation
  let wpm = 0;
  if (ghostData.length >= 2) {
    const firstMs = ghostData[0].ms;
    const lastMs = ghostData[ghostData.length - 1].ms;
    const elapsedMs = lastMs - firstMs;
    if (elapsedMs > 0) {
      wpm = Math.round((wordCount / elapsedMs) * 60000);
    }
  }

  // Accuracy calculation
  const accuracy = totalKeystrokes > 0 ? correctKeystrokes / totalKeystrokes : 0;

  return { wpm, accuracy };
}
