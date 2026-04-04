"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";

export function CreateRoomClient() {
  const router = useRouter();
  const { socket, status } = useSocket();
  const createdRef = useRef(false);

  useEffect(() => {
    if (!socket) return;

    function onRoomCreated({ roomCode }: { roomCode: string }) {
      router.push(`/lobby/${roomCode}`);
    }

    socket.on("room-created", onRoomCreated);
    return () => {
      socket.off("room-created", onRoomCreated);
    };
  }, [socket, router]);

  // Auto-create room once connected
  useEffect(() => {
    if (socket && status === "connected" && !createdRef.current) {
      createdRef.current = true;
      socket.emit("create-room", { difficulty: "medium" });
    }
  }, [socket, status]);

  return (
    <main className="min-h-screen bg-pixel-black flex items-center justify-center">
      <p className="font-heading text-pixel-text-dim text-sm animate-pulse">
        CREATING ROOM...
      </p>
    </main>
  );
}
