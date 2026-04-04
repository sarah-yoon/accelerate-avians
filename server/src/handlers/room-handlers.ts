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
      // If already in room, just send current room state instead of error
      if (result.error === "Already in this room") {
        const existingRoom = roomManager.getRoom(roomCode);
        if (existingRoom) {
          // Update socket ID in case it changed (e.g. page navigation)
          const player = existingRoom.players.get(user.id);
          if (player) {
            player.socketId = socket.id;
            player.isConnected = true;
            player.disconnectedAt = null;
          }
          socket.data.roomCode = roomCode;
          socket.join(roomCode);

          const players = Array.from(existingRoom.players.values()).map((p) => ({
            userId: p.userId,
            username: p.username,
            displayBird: p.displayBird,
            isHost: p.isHost,
            isConnected: p.isConnected,
          }));

          socket.emit("room-state", {
            code: existingRoom.code,
            status: existingRoom.status,
            hostUserId: existingRoom.hostUserId,
            yourUserId: user.id,
            difficulty: existingRoom.difficulty,
            players,
          });
          return;
        }
      }
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

  socket.on("leave-room", ({ roomCode }) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    let userId: string | null = null;
    for (const p of room.players.values()) {
      if (p.socketId === socket.id) {
        userId = p.userId;
        break;
      }
    }
    if (!userId) return;

    const result = roomManager.removePlayer(roomCode, userId);
    socket.data.roomCode = null;
    socket.leave(roomCode);

    if (result && !result.roomDeleted) {
      io.to(roomCode).emit("player-left", { userId });
      // If host transferred, send updated room state
      if (result.newHostUserId) {
        const updatedRoom = roomManager.getRoom(roomCode);
        if (updatedRoom) {
          const players = Array.from(updatedRoom.players.values()).map((p) => ({
            userId: p.userId,
            username: p.username,
            displayBird: p.displayBird,
            isHost: p.isHost,
            isConnected: p.isConnected,
          }));
          io.to(roomCode).emit("room-state", {
            code: updatedRoom.code,
            status: updatedRoom.status,
            hostUserId: updatedRoom.hostUserId,
            difficulty: updatedRoom.difficulty,
            players,
          });
        }
      }
    }
  });

  socket.on("play-again", ({ roomCode }) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    // Verify sender is the host
    let isHost = false;
    for (const p of room.players.values()) {
      if (p.socketId === socket.id && p.isHost) {
        isHost = true;
        break;
      }
    }
    if (!isHost) {
      socket.emit("room-error", { message: "Only the host can restart" });
      return;
    }

    // Reset room to waiting state
    roomManager.setRoomStatus(roomCode, "waiting");
    room.passageId = null;
    room.passageText = null;
    room.passageCharCount = null;
    room.raceStartedAt = null;
    room.maxDurationMs = null;

    // Send updated room state to all players
    const players = Array.from(room.players.values()).map((p) => ({
      userId: p.userId,
      username: p.username,
      displayBird: p.displayBird,
      isHost: p.isHost,
      isConnected: p.isConnected,
    }));

    io.to(roomCode).emit("room-state", {
      code: room.code,
      status: "waiting",
      hostUserId: room.hostUserId,
      difficulty: room.difficulty,
      players,
    });
  });

  socket.on("change-difficulty", ({ roomCode, difficulty }) => {
    const room = roomManager.getRoom(roomCode);
    if (!room || room.status !== "waiting") return;

    // Verify sender is the host
    let isHost = false;
    for (const p of room.players.values()) {
      if (p.socketId === socket.id && p.isHost) {
        isHost = true;
        break;
      }
    }
    if (!isHost) return;

    room.difficulty = difficulty;

    // Broadcast updated state to all players
    const players = Array.from(room.players.values()).map((p) => ({
      userId: p.userId,
      username: p.username,
      displayBird: p.displayBird,
      isHost: p.isHost,
      isConnected: p.isConnected,
    }));

    io.to(roomCode).emit("room-state", {
      code: room.code,
      status: room.status,
      hostUserId: room.hostUserId,
      difficulty: room.difficulty,
      players,
    });
  });
}
