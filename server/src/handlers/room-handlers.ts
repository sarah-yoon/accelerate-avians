import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types.js";
import type { RoomManager } from "../rooms/room-manager.js";
import { prisma } from "../lib/prisma.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerRoomHandlers(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager
): void {
  socket.on("create-room", async ({ difficulty }) => {
    const { userId } = socket.data;

    // Look up user from DB to get fresh username/displayBird
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      socket.emit("room-error", { message: "User not found. Complete onboarding first." });
      return;
    }

    const room = roomManager.createRoom(
      user.id,
      user.username,
      user.displayBird,
      socket.id,
      difficulty
    );

    socket.data.roomCode = room.code;
    socket.data.username = user.username;
    socket.data.displayBird = user.displayBird;
    socket.join(room.code);

    socket.emit("room-created", { roomCode: room.code });
  });

  socket.on("join-room", async ({ roomCode }) => {
    const { userId } = socket.data;

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      socket.emit("room-error", { message: "User not found. Complete onboarding first." });
      return;
    }

    const result = roomManager.joinRoom(
      roomCode,
      user.id,
      user.username,
      user.displayBird,
      socket.id
    );

    if (!result.success) {
      socket.emit("room-error", { message: result.error });
      return;
    }

    socket.data.roomCode = roomCode;
    socket.data.username = user.username;
    socket.data.displayBird = user.displayBird;
    socket.join(roomCode);

    // Notify all players in the room
    io.to(roomCode).emit("player-joined", {
      userId: user.id,
      username: user.username,
      displayBird: user.displayBird,
    });

    // Send full room state to the joining player
    const room = roomManager.getRoom(roomCode)!;
    const players = Array.from(room.players.values()).map((p) => ({
      userId: p.userId,
      username: p.username,
      displayBird: p.displayBird,
      isHost: p.isHost,
      isConnected: p.isConnected,
    }));

    socket.emit("room-state", {
      code: room.code,
      status: room.status,
      hostUserId: room.hostUserId,
      yourUserId: user.id,
      difficulty: room.difficulty,
      players,
    });
  });
}
