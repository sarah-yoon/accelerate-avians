import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { validateScore } from "@/lib/score-validator";
import { sampleGhostData } from "@/lib/ghost-sampler";
import type { GhostDataPoint, ScoreSubmission } from "@/types";

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = (await request.json()) as ScoreSubmission;
  const { passageId, ghostData, totalKeystrokes, correctKeystrokes } = body;

  if (!passageId || !ghostData || !totalKeystrokes) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const passage = await prisma.passage.findUnique({
    where: { id: passageId },
  });
  if (!passage) {
    return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  }

  const validation = validateScore({
    ghostData: ghostData as GhostDataPoint[],
    wordCount: passage.wordCount,
    totalKeystrokes,
    correctKeystrokes,
  });

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.reason },
      { status: 400 }
    );
  }

  const sampledGhostData = sampleGhostData(ghostData as GhostDataPoint[]);

  const score = await prisma.score.create({
    data: {
      userId: user.id,
      passageId,
      wpm: validation.wpm,
      accuracy: validation.accuracy,
      ghostData: sampledGhostData as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(
    {
      id: score.id,
      wpm: validation.wpm,
      accuracy: validation.accuracy,
    },
    { status: 201 }
  );
}
