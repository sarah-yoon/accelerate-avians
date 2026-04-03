import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LobbyClient } from "./lobby-client";

interface LobbyPageProps {
  params: Promise<{ code: string }>;
}

export default async function LobbyPage({ params }: LobbyPageProps) {
  const { userId } = await auth();
  const { code } = await params;

  if (!userId) {
    redirect(`/sign-in?redirect=/lobby/${code}`);
  }

  return <LobbyClient roomCode={code} />;
}
