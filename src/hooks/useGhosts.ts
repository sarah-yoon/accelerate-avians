import { useCallback } from "react";
import { interpolateGhostProgress } from "@/components/race/race-renderer";
import type { GhostRacer } from "@/types";

export function useGhosts(ghosts: GhostRacer[], totalChars: number) {
  const getGhostProgresses = useCallback(
    (elapsedMs: number): Map<string, number> => {
      const progresses = new Map<string, number>();
      for (const ghost of ghosts) {
        const progress = interpolateGhostProgress(
          ghost.ghostData,
          elapsedMs,
          totalChars
        );
        progresses.set(ghost.id, progress);
      }
      return progresses;
    },
    [ghosts, totalChars]
  );

  return { getGhostProgresses };
}
