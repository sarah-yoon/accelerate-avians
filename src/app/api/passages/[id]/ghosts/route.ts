import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import type { GhostRacer } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`ghosts:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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
        clientGhostData: personalBest.clientGhostData as { charIndex: number; ms: number }[],
        isPersonalBest: true,
      });
    }
  }

  // 2. Compute player's avg WPM for skill-tier ghost selection
  let avgWpm = 45; // default for new players (median-ish)
  if (userId) {
    const stats = await prisma.score.aggregate({
      where: { userId },
      _avg: { wpm: true },
    });
    if (stats._avg.wpm) {
      avgWpm = Math.round(stats._avg.wpm);
    }
  }

  // Skill tiers: one slightly below, one at level, one above
  const tiers = [
    { min: Math.max(25, avgWpm - 15), max: Math.max(25, avgWpm - 5) },  // below
    { min: Math.max(25, avgWpm - 5), max: avgWpm + 5 },                  // at level
    { min: avgWpm + 10, max: avgWpm + 30 },                              // above
  ];

  for (const tier of tiers) {
    if (ghosts.length >= 4) break; // personal best + 3 ghosts max

    const ghost = await prisma.score.findFirst({
      where: {
        passageId,
        wpm: { gte: tier.min, lte: tier.max },
        user: { clerkId: { startsWith: "bot_" } },
        id: { notIn: ghosts.map((g) => g.id) },
      },
      orderBy: { wpm: "asc" },
      include: { user: { select: { id: true, username: true, displayBird: true } } },
    });

    if (ghost) {
      ghosts.push({
        id: ghost.id,
        username: ghost.user.username,
        displayBird: ghost.user.displayBird,
        wpm: ghost.wpm,
        clientGhostData: ghost.clientGhostData as { charIndex: number; ms: number }[],
      });
    }
  }

  // 3. If not enough ghosts, fill with any available bot scores
  if (ghosts.length < 4) {
    const fillers = await prisma.score.findMany({
      where: {
        passageId,
        id: { notIn: ghosts.map((g) => g.id) },
        user: { clerkId: { startsWith: "bot_" } },
      },
      take: 4 - ghosts.length,
      orderBy: { wpm: "asc" },
      include: { user: { select: { id: true, username: true, displayBird: true } } },
    });

    for (const score of fillers) {
      ghosts.push({
        id: score.id,
        username: score.user.username,
        displayBird: score.user.displayBird,
        wpm: score.wpm,
        clientGhostData: score.clientGhostData as { charIndex: number; ms: number }[],
      });
    }
  }

  return NextResponse.json({ ghosts });
}
