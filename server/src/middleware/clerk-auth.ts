import { verifyToken } from "@clerk/backend";
import type { Socket } from "socket.io";
import type { SocketData, ClientToServerEvents, ServerToClientEvents } from "../types.js";

type AuthSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function createClerkAuthMiddleware(clerkSecretKey: string, clerkPublishableKey: string) {
  return async (socket: AuthSocket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth?.token;

    if (!token || typeof token !== "string") {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: clerkSecretKey,
        authorizedParties: undefined,
      });

      if (!payload.sub) {
        return next(new Error("Invalid token: no subject"));
      }

      // Store user info on socket.data for all handlers to use
      socket.data.userId = payload.sub;
      // username and displayBird will be set from DB lookup after auth
      socket.data.username = (payload as Record<string, unknown>).username as string ?? "Unknown";
      socket.data.displayBird = (payload as Record<string, unknown>).displayBird as string ?? "robin";
      socket.data.roomCode = null;

      next();
    } catch (error) {
      return next(new Error("Invalid or expired token"));
    }
  };
}
