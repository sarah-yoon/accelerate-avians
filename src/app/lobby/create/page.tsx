import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CreateRoomClient } from "./create-room-client";

export default async function CreateRoomPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in?redirect=/lobby/create");
  }

  return <CreateRoomClient />;
}
