import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await request.text();
  const wh = new Webhook(webhookSecret);

  let event: { type: string; data: Record<string, unknown> };
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type: string; data: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const { id, username, first_name } = event.data as {
      id: string;
      username?: string;
      first_name?: string;
    };
    const displayName = username || first_name || `avian_${id.slice(-6)}`;
    await prisma.user.upsert({
      where: { clerkId: id },
      update: { username: displayName },
      create: { clerkId: id, username: displayName, displayBird: "sparrow" },
    });
  }

  if (event.type === "user.deleted") {
    const { id } = event.data as { id: string };
    await prisma.user.deleteMany({ where: { clerkId: id } });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
