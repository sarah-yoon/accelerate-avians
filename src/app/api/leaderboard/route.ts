import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Difficulty } from "@/types";

const VALID_DIFFICULTIES: Difficulty[] = ["short", "medium", "long"];

// Simple in-memory cache
let cachedData: { entries: unknown[]; timestamp: number; key: string } | null =
  null;
const CACHE_TTL = 60_000; // 60 seconds

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const difficulty = searchParams.get("difficulty") as Difficulty | null;

  const cacheKey = `leaderboard_${difficulty || "all"}`;

  // Check cache
  if (cachedData && cachedData.key === cacheKey && Date.now() - cachedData.timestamp < CACHE_TTL) {
    return NextResponse.json({ entries: cachedData.entries });
  }

  const where: Record<string, unknown> = {
    user: { clerkId: { not: { startsWith: "bot_" } } },
  };

  if (difficulty && VALID_DIFFICULTIES.includes(difficulty)) {
    where.passage = { difficulty };
  }

  const scores = await prisma.score.findMany({
    where,
    orderBy: { wpm: "desc" },
    take: 100,
    distinct: ["userId"],
    include: {
      user: { select: { id: true, username: true, displayBird: true } },
    },
  });

  const entries = scores.map((s) => ({
    userId: s.user.id,
    username: s.user.username,
    displayBird: s.user.displayBird,
    wpm: s.wpm,
    accuracy: s.accuracy,
    createdAt: s.createdAt.toISOString(),
  }));

  // Update cache
  cachedData = { entries, timestamp: Date.now(), key: cacheKey };

  return NextResponse.json({ entries });
}
