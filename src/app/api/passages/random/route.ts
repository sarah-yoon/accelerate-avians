import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import type { Difficulty } from "@/types";

const VALID_DIFFICULTIES: Difficulty[] = ["short", "medium", "long"];

export async function GET(request: Request) {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`passages:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { searchParams } = new URL(request.url);
  const difficulty = searchParams.get("difficulty") as Difficulty | null;

  const where =
    difficulty && VALID_DIFFICULTIES.includes(difficulty)
      ? { difficulty }
      : {};

  const count = await prisma.passage.count({ where });
  if (count === 0) {
    return NextResponse.json(
      { error: "No passages available" },
      { status: 404 }
    );
  }

  const skip = Math.floor(Math.random() * count);
  const [passage] = await prisma.passage.findMany({
    where,
    skip,
    take: 1,
  });

  return NextResponse.json(passage);
}
