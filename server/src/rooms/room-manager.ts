import { generateRoomCode } from "./room-code.js";
import type { Room, RoomPlayer, RoomStatus } from "../types.js";
import { prisma } from "../lib/prisma.js";

const MAX_PLAYERS = 6;
const ROOM_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

interface RemoveResult {
  removed: boolean;
  roomDeleted: boolean;
  newHostUserId: string | null;
}

type JoinResult =
  | { success: true; room: Room }
  | { success: false; error: string };

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Run cleanup every 60 seconds
    this.cleanupTimer = setInterval(() => this.cleanupExpiredRooms(), 60_000);
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    // Clear all room timers
    for (const room of this.rooms.values()) {
      if (room.raceTimeoutTimer) clearTimeout(room.raceTimeoutTimer);
      if (room.progressBroadcastInterval) clearInterval(room.progressBroadcastInterval);
    }
    this.rooms.clear();
  }

  createRoom(
    userId: string,
    username: string,
    displayBird: string,
    socketId: string,
    difficulty: "short" | "medium" | "long"
  ): Room {
    let code: string;
    do {
      code = generateRoomCode();
    } while (this.rooms.has(code));

    const player: RoomPlayer = {
      userId,
      username,
      displayBird,
      socketId,
      isHost: true,
      isConnected: true,
      disconnectedAt: null,
    };

    const room: Room = {
      code,
      status: "waiting",
      hostUserId: userId,
      difficulty,
      players: new Map([[userId, player]]),
      passageId: null,
      passageText: null,
      passageCharCount: null,
      raceStartedAt: null,
      maxDurationMs: null,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      raceTimeoutTimer: null,
      progressBroadcastInterval: null,
    };

    this.rooms.set(code, room);
    return room;
  }

  joinRoom(
    code: string,
    userId: string,
    username: string,
    displayBird: string,
    socketId: string
  ): JoinResult {
    const room = this.rooms.get(code);
    if (!room || room.status === "expired" || room.status === "completed") {
      return { success: false, error: "Room not found or expired" };
    }
    if (room.status === "racing") {
      return { success: false, error: "Race already in progress" };
    }
    if (room.players.has(userId)) {
      return { success: false, error: "Already in this room" };
    }
    if (room.players.size >= MAX_PLAYERS) {
      return { success: false, error: "Room is full" };
    }

    const player: RoomPlayer = {
      userId,
      username,
      displayBird,
      socketId,
      isHost: false,
      isConnected: true,
      disconnectedAt: null,
    };

    room.players.set(userId, player);
    room.lastActivityAt = Date.now();
    return { success: true, room };
  }

  removePlayer(code: string, userId: string): RemoveResult | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    room.players.delete(userId);
    room.lastActivityAt = Date.now();

    if (room.players.size === 0) {
      if (room.raceTimeoutTimer) clearTimeout(room.raceTimeoutTimer);
      if (room.progressBroadcastInterval) clearInterval(room.progressBroadcastInterval);
      this.rooms.delete(code);
      return { removed: true, roomDeleted: true, newHostUserId: null };
    }

    let newHostUserId: string | null = null;
    if (userId === room.hostUserId && room.status === "waiting") {
      // Transfer host to first remaining player (oldest by insertion order)
      const firstPlayer = room.players.values().next().value!;
      firstPlayer.isHost = true;
      room.hostUserId = firstPlayer.userId;
      newHostUserId = firstPlayer.userId;
    }

    return { removed: true, roomDeleted: false, newHostUserId };
  }

  disconnectPlayer(code: string, userId: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    const player = room.players.get(userId);
    if (!player) return;
    player.isConnected = false;
    player.disconnectedAt = Date.now();
  }

  reconnectPlayer(code: string, userId: string, newSocketId: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    const player = room.players.get(userId);
    if (!player) return false;
    player.isConnected = true;
    player.socketId = newSocketId;
    player.disconnectedAt = null;
    room.lastActivityAt = Date.now();
    return true;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  getRoomBySocketId(socketId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      for (const player of room.players.values()) {
        if (player.socketId === socketId) return room;
      }
    }
    return undefined;
  }

  setRoomStatus(code: string, status: RoomStatus): void {
    const room = this.rooms.get(code);
    if (room) {
      room.status = status;
      room.lastActivityAt = Date.now();
    }
  }

  touchRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room) {
      room.lastActivityAt = Date.now();
    }
  }

  async incrementEpoch(matchId: string, userId: string): Promise<number> {
    // Single-statement atomic increment — no read-modify-write race window.
    const rows = await prisma.$queryRaw<{ new_epoch: string }[]>`
      UPDATE "matches"
      SET epochs = jsonb_set(
        COALESCE(epochs, '{}'::jsonb),
        ARRAY[${userId}],
        to_jsonb(COALESCE((epochs->>${userId})::int, 0) + 1)
      )
      WHERE id = ${matchId}
      RETURNING epochs->>${userId} AS new_epoch
    `;
    if (rows.length === 0) throw new Error(`Match ${matchId} not found`);
    return Number(rows[0].new_epoch);
  }

  cleanupExpiredRooms(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivityAt > ROOM_EXPIRY_MS) {
        if (room.raceTimeoutTimer) clearTimeout(room.raceTimeoutTimer);
        if (room.progressBroadcastInterval) clearInterval(room.progressBroadcastInterval);
        this.rooms.delete(code);
      }
    }
  }
}
