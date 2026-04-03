import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  RoomStatus,
} from "../types.js";
import type { RoomManager } from "../rooms/room-manager.js";
import type { RaceController } from "../race/race-controller.js";
import { finishRace } from "./race-handlers.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const RECONNECT_GRACE_MS = 30_000;
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function handleDisconnect(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager,
  raceController: RaceController
): void {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;

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

  if (room.status === "racing") {
    roomManager.disconnectPlayer(roomCode, userId);
    io.to(roomCode).emit("player-left", { userId });

    const capturedUserId = userId;
    const timerKey = `${roomCode}:${capturedUserId}`;
    const timer = setTimeout(() => {
      disconnectTimers.delete(timerKey);
      const currentRoom = roomManager.getRoom(roomCode);
      if (!currentRoom) return;

      roomManager.removePlayer(roomCode, capturedUserId);

      if (raceController.allPlayersFinished(roomCode)) {
        finishRace(io, roomCode, currentRoom, roomManager, raceController);
      }
    }, RECONNECT_GRACE_MS);

    disconnectTimers.set(timerKey, timer);
  } else if (room.status === "waiting") {
    const result = roomManager.removePlayer(roomCode, userId);
    if (result && !result.roomDeleted) {
      io.to(roomCode).emit("player-left", { userId });
      if (result.newHostUserId) {
        const updatedRoom = roomManager.getRoom(roomCode);
        if (updatedRoom) {
          emitRoomState(io, roomCode, updatedRoom);
        }
      }
    }
  }
}

export function handleReconnect(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager,
  raceController: RaceController,
  roomCode: string,
  userId: string
): boolean {
  const room = roomManager.getRoom(roomCode);
  if (!room) return false;

  const success = roomManager.reconnectPlayer(roomCode, userId, socket.id);
  if (!success) return false;

  const timerKey = `${roomCode}:${userId}`;
  const timer = disconnectTimers.get(timerKey);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(timerKey);
  }

  socket.data.roomCode = roomCode;
  socket.join(roomCode);

  io.to(roomCode).emit("player-reconnected", { userId });

  // Build room state for reconnecting player
  const players = Array.from(room.players.values()).map((p) => ({
    userId: p.userId,
    username: p.username,
    displayBird: p.displayBird,
    isHost: p.isHost,
    isConnected: p.isConnected,
  }));

  const statePayload: {
    code: string;
    status: RoomStatus;
    hostUserId: string;
    yourUserId: string;
    difficulty: "short" | "medium" | "long";
    players: typeof players;
    passage?: { id: string; text: string; charCount: number; wordCount: number };
    raceStartedAt?: number;
    yourCharIndex?: number;
  } = {
    code: room.code,
    status: room.status,
    hostUserId: room.hostUserId,
    yourUserId: userId,
    difficulty: room.difficulty,
    players,
  };

  if (
    room.status === "racing" &&
    room.passageId &&
    room.passageText &&
    room.passageCharCount
  ) {
    statePayload.passage = {
      id: room.passageId,
      text: room.passageText,
      charCount: room.passageCharCount,
      wordCount: room.passageText.split(/\s+/).length,
    };
    statePayload.raceStartedAt = room.raceStartedAt ?? undefined;

    const progressSnapshot = raceController.getProgressSnapshot(roomCode);
    const myProgress = progressSnapshot.find((p) => p.userId === userId);
    if (myProgress) {
      statePayload.yourCharIndex = Math.floor(
        myProgress.progress * room.passageCharCount
      );
    }
  }

  socket.emit("room-state", statePayload);
  return true;
}

function emitRoomState(
  io: AppServer,
  roomCode: string,
  room: NonNullable<ReturnType<RoomManager["getRoom"]>>
): void {
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
}
