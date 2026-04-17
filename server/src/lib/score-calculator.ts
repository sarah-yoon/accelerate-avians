interface ProgressSample {
  charIndex: number;
  ms?: number;          // legacy client field
  serverMs?: number;    // new server field
}

interface RaceResult {
  wpm: number;
  accuracy: number;
}

export function calculateResults(
  progressSamples: ProgressSample[],
  wordCount: number,
  correctKeystrokes: number,
  totalKeystrokes: number
): RaceResult {
  let wpm = 0;
  if (progressSamples.length >= 2) {
    const stamp = (s: ProgressSample) => s.serverMs ?? s.ms ?? 0;
    const elapsedMs = stamp(progressSamples[progressSamples.length - 1]) - stamp(progressSamples[0]);
    if (elapsedMs > 0) {
      wpm = Math.round((wordCount / elapsedMs) * 60000);
    }
  }
  const accuracy = totalKeystrokes > 0 ? correctKeystrokes / totalKeystrokes : 0;
  return { wpm, accuracy };
}
