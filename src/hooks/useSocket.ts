"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { Socket } from "socket.io-client";
import { getSocket, disconnectSocket } from "@/lib/socket";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

interface UseSocketReturn {
  socket: Socket | null;
  status: ConnectionStatus;
  error: string | null;
}

export function useSocket(): UseSocketReturn {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const sock = getSocket(token);

        sock.on("connect", () => {
          if (!cancelled) {
            setSocket(sock);
            setStatus("connected");
            setError(null);
          }
        });

        sock.on("disconnect", (reason) => {
          if (!cancelled) {
            if (reason === "io server disconnect") {
              setStatus("disconnected");
              setError("Server closed the connection");
            } else {
              setStatus("reconnecting");
            }
          }
        });

        sock.on("connect_error", (err) => {
          if (!cancelled) {
            setError(err.message);
            setStatus("disconnected");
          }
        });

        sock.io.on("reconnect", () => {
          if (!cancelled) {
            setStatus("connected");
            setError(null);
          }
        });

        sock.io.on("reconnect_failed", () => {
          if (!cancelled) {
            setStatus("disconnected");
            setError("Connection lost. Please create a new room.");
          }
        });

        if (!sock.connected) {
          sock.connect();
        } else {
          setSocket(sock);
          setStatus("connected");
        }
      } catch {
        if (!cancelled) {
          setError("Failed to authenticate");
          setStatus("disconnected");
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      // Don't disconnect on unmount — keep socket alive across page navigation.
      // The singleton in socket.ts persists and reconnects on the next page.
    };
  }, [getToken]);

  return {
    socket,
    status,
    error,
  };
}
