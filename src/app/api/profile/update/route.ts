import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const VALID_BIRDS = [
  "sparrow", "robin", "canary", "bluebird",
  "cardinal", "owl", "puffin", "peacock", "falcon", "toucan", "snowy-owl", "bluejay",
  "sparq", "tank", "glitch", "nova", "sunny", "rex", "prism", "king",
  "parrot", "duck", "eagle", "pigeon", "robin-bird", "swallow", "kingfisher",
  "bee-eater", "hummingbird", "macaw", "seagull", "pelican", "albatross",
  "kestrel", "red-kite", "osprey", "swift", "nightjar",
];

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { username, displayBird } = body as { username?: string; displayBird?: string };

  if (username) {
    if (username.length < 3 || username.length > 20) {
      return NextResponse.json({ error: "Username must be 3-20 characters" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: "Username can only contain letters, numbers, and underscores" }, { status: 400 });
    }
  }

  if (displayBird && !VALID_BIRDS.includes(displayBird)) {
    return NextResponse.json({ error: "Invalid bird selection" }, { status: 400 });
  }

  if (!username && !displayBird) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const updateData: Record<string, string> = {};
    if (username) updateData.username = username;
    if (displayBird) updateData.displayBird = displayBird;

    const user = await prisma.user.upsert({
      where: { clerkId },
      update: updateData,
      create: { clerkId, username: username || `avian_${clerkId.slice(-6)}`, displayBird: displayBird || "sparrow" },
    });
    return NextResponse.json({ user }, { status: 200 });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    throw error;
  }
}
