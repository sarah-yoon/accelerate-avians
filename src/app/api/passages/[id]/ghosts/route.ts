import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { GhostRacer } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: passageId } = await params;
  const { searchParams } = new URL(request.url);
  const clerkId = searchParams.get("clerkId");

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

  // 2. Get baseline WPM for ghost tier selection
  // Use player's personal avg WPM if available, otherwise community median
  let baselineWpm = 60;
  if (userId) {
    const playerAvg = await prisma.score.aggregate({
      where: { userId },
      _avg: { wpm: true },
    });
    if (playerAvg._avg.wpm) {
      baselineWpm = playerAvg._avg.wpm;
    }
  }
  if (baselineWpm === 60) {
    // Fallback: use community average for this passage
    const communityAvg = await prisma.score.aggregate({
      where: { passageId },
      _avg: { wpm: true },
    });
    baselineWpm = communityAvg._avg.wpm ?? 60;
  }
  const avgWpm = baselineWpm;

  // 3. Get community ghosts at different skill tiers: avg-10, avg, avg+20
  const tiers = [
    Math.max(25, Math.round(avgWpm - 10)),
    Math.round(avgWpm),
    Math.round(avgWpm + 20),
  ];

  for (const targetWpm of tiers) {
    const score = await prisma.score.findFirst({
      where: {
        passageId,
        wpm: { gte: targetWpm - 5, lte: targetWpm + 5 },
        ...(userId ? { userId: { not: userId } } : {}),
      },
      orderBy: { wpm: "asc" },
      include: { user: { select: { id: true, username: true, displayBird: true } } },
    });

    if (score && !ghosts.find((g) => g.id === score.id)) {
      ghosts.push({
        id: score.id,
        username: score.user.username,
        displayBird: score.user.displayBird,
        wpm: score.wpm,
        ghostData: score.ghostData as { charIndex: number; ms: number }[],
      });
    }
  }

  // If we don't have enough ghosts, fill with any available scores
  if (ghosts.length < 3) {
    const fillers = await prisma.score.findMany({
      where: {
        passageId,
        id: { notIn: ghosts.map((g) => g.id) },
      },
      take: 3 - ghosts.length,
      orderBy: { wpm: "desc" },
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
