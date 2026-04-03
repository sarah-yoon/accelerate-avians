import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clerkId = searchParams.get("clerkId");

  if (!clerkId) {
    return NextResponse.json({ needsOnboarding: false });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { username: true },
  });

  // User doesn't exist yet (webhook hasn't fired) or has auto-generated username
  const needsOnboarding = !user || user.username.startsWith("avian_");

  return NextResponse.json({ needsOnboarding });
}
