import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { GhostRacer } from "@/types";

// Bot difficulty WPM ranges
const BOT_WPM_RANGES = {
  easy: { min: 20, max: 45 },
  medium: { min: 40, max: 75 },
  hard: { min: 60, max: 110 },
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: passageId } = await params;
  const { searchParams } = new URL(request.url);
  const clerkId = searchParams.get("clerkId");
  const botDifficulty = searchParams.get("botDifficulty") as "easy" | "medium" | "hard" | null;

  // Resolve clerkId to internal userId
  let userId: string | null = null;
  if (clerkId) {
    const user = await prisma.user.findUnique({ where: { clerkId } });
    userId = user?.id ?? null;
  }

  const ghosts: GhostRacer[] = [];

  // 1. Personal best (if userId resolved)
  if (userId) {
    const personalBest = await prisma.score.findFirst({
      where: { passageId, userId },
      orderBy: { wpm: "desc" },
      include: { user: { select: { id: true, username: true, displayBird: true } } },
    });

    if (personalBest) {
      ghosts.push({
        id: personalBest.id,
        username: personalBest.user.username,
        displayBird: personalBest.user.displayBird,
        wpm: personalBest.wpm,
        ghostData: personalBest.ghostData as { charIndex: number; ms: number }[],
        isPersonalBest: true,
      });
    }
  }

  // 2. Get bot ghosts based on difficulty selection
  const wpmRange = BOT_WPM_RANGES[botDifficulty || "easy"];

  const botGhosts = await prisma.score.findMany({
    where: {
      passageId,
      wpm: { gte: wpmRange.min, lte: wpmRange.max },
      user: { clerkId: { startsWith: "bot_" } },
      id: { notIn: ghosts.map((g) => g.id) },
    },
    take: 3,
    orderBy: { wpm: "asc" },
    include: { user: { select: { id: true, username: true, displayBird: true } } },
  });

  for (const score of botGhosts) {
    ghosts.push({
      id: score.id,
      username: score.user.username,
      displayBird: score.user.displayBird,
      wpm: score.wpm,
      ghostData: score.ghostData as { charIndex: number; ms: number }[],
    });
  }

  // 3. If not enough ghosts, fill with any available bot scores for this passage
  if (ghosts.length < 3) {
    const fillers = await prisma.score.findMany({
      where: {
        passageId,
        id: { notIn: ghosts.map((g) => g.id) },
        user: { clerkId: { startsWith: "bot_" } },
      },
      take: 3 - ghosts.length,
      orderBy: { wpm: "asc" },
      include: { user: { select: { id: true, username: true, displayBird: true } } },
    });

    for (const score of fillers) {
      ghosts.push({
        id: score.id,
        username: score.user.username,
        displayBird: score.user.displayBird,
        wpm: score.wpm,
        ghostData: score.ghostData as { charIndex: number; ms: number }[],
      });
    }
  }

  return NextResponse.json({ ghosts });
}
