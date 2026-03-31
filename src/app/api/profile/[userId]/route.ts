import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: clerkId } = await params;

  // Accept clerkId as the URL parameter (matches what Clerk provides on client)
  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const scores = await prisma.score.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      passageId: true,
      wpm: true,
      accuracy: true,
      createdAt: true,
    },
  });

  const avgResult = await prisma.score.aggregate({
    where: { userId: user.id },
    _avg: { wpm: true, accuracy: true },
    _max: { wpm: true, accuracy: true },
    _count: true,
  });

  return NextResponse.json({
    userId: user.id,
    username: user.username,
    displayBird: user.displayBird,
    avgWpm: Math.round(avgResult._avg.wpm ?? 0),
    avgAccuracy: avgResult._avg.accuracy ?? 0,
    bestWpm: avgResult._max.wpm ?? 0,
    bestAccuracy: avgResult._max.accuracy ?? 0,
    totalRaces: avgResult._count,
    recentRaces: scores.map((s) => ({
      passageId: s.passageId,
      wpm: s.wpm,
      accuracy: s.accuracy,
      createdAt: s.createdAt.toISOString(),
    })),
  });
}
