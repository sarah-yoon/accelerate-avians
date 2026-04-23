import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Revalidate at most every 5 minutes — exact counts aren't load-bearing,
// and we want to keep DB hit rate low even under a flood of landing visits.
export const revalidate = 300;

/**
 * GET /api/stats/totals
 * Returns running totals for the landing-page live counter:
 *   { races, words }
 *
 * - `races` = count of non-flagged Score rows (solo runs).
 * - `words` = sum of wordCount across all those scores' passages.
 *
 * If the query fails for any reason, returns 200 with { races: null, words: null }
 * so the landing page can gracefully hide the counter rather than surface an error.
 */
export async function GET() {
  try {
    const [races, scoresWithPassage] = await Promise.all([
      prisma.score.count({ where: { flagged: false } }),
      prisma.score.findMany({
        where: { flagged: false },
        select: { passage: { select: { wordCount: true } } },
      }),
    ]);
    const words = scoresWithPassage.reduce(
      (sum, s) => sum + (s.passage?.wordCount ?? 0),
      0
    );
    return NextResponse.json({ races, words });
  } catch {
    return NextResponse.json({ races: null, words: null });
  }
}
