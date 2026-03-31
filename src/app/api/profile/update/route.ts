import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const VALID_BIRDS = ["robin", "canary", "bluebird"];

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { username, displayBird } = body as { username?: string; displayBird?: string };

  if (!username || username.length < 3 || username.length > 20) {
    return NextResponse.json({ error: "Username must be 3-20 characters" }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return NextResponse.json({ error: "Username can only contain letters, numbers, and underscores" }, { status: 400 });
  }

  if (displayBird && !VALID_BIRDS.includes(displayBird)) {
    return NextResponse.json({ error: "Invalid bird selection" }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { clerkId },
      data: { username, displayBird: displayBird || "robin" },
    });
    return NextResponse.json({ user }, { status: 200 });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    throw error;
  }
}
