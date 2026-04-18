import { randomBytes } from "node:crypto";
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types.js";
import type { RoomManager } from "../rooms/room-manager.js";
import type { RaceController } from "../race/race-controller.js";
import { finishRace } from "./race-handlers.js";
import { mintResumeToken, verifyResumeToken } from "../lib/resume-token.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// ── SlowConsumerSampler ───────────────────────────────────────────────────────

/**
 * Maximum outgoing buffer size before a socket is considered a slow consumer.
 * Spec § 2.4: 64 KB.
 */
export const SLOW_BUFFER_LIMIT_BYTES = 64 * 1024;

/**
 * Samples a socket's outgoing buffer every call. If the buffered amount
 * exceeds SLOW_BUFFER_LIMIT_BYTES for TWO consecutive samples the socket is
 * force-disconnected with reason "buffer-overflow".
 *
 * Spec § 2.4: sampled every 2 seconds by the production interval.
 */
export class SlowConsumerSampler {
  private consecutive = 0;
  constructor(private socket: Socket) {}
  sample(): void {
    const buffered = (this.socket as any).conn?.transport?.writable?.bufferedAmount ?? 0;
    if (buffered > SLOW_BUFFER_LIMIT_BYTES) {
      this.consecutive++;
      if (this.consecutive >= 2) {
        this.socket.disconnect("buffer-overflow" as any);
      }
    } else {
      this.consecutive = 0;
    }
  }
}
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Time a disconnected player's seat is held before they are marked DNF.
 * Spec § 2.3 step 5: "RECONNECT_WINDOW_MS = 20_000".
 */
const RECONNECT_WINDOW_MS = 20_000;

/**
 * Number of times a single resumeToken may be used for verification before it
 * is rejected. Spec § 2.3: "each resumeToken is valid for at most 3 verify attempts."
 */
const MAX_TOKEN_ATTEMPTS = 3;

// ── Module-level state ────────────────────────────────────────────────────────

/**
 * Timers set on disconnect to trigger DNF if the player does not reconnect
 * within RECONNECT_WINDOW_MS. Key: `${roomCode}:${userId}`.
 */
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Per-token attempt counters for the reconnect-cap guard.
 * Key: the raw token string; value: number of verify calls against that token.
 */
const tokenAttempts = new Map<string, number>();

/**
 * Session state stored when a player first connects (or reconnects).
 * Key: `${userId}:${roomCode}`.
 *
 * This is the authoritative source for the current epoch so the reconnect
 * handler can compare the epoch inside the submitted token against what we
 * expect without a DB round-trip.
 */
export interface SessionEntry {
  /** Current expected epoch for this (userId, roomCode) pair. */
  epoch: number;
  /** Random nonce baked into the most-recently minted token. */
  sessionId: string;
  /** Prisma Match.id for this room (needed to call incrementEpoch). */
  matchId: string;
}

/**
 * Module-level session store. In production this is passed in by the server
 * index and shared; in tests each test constructs its own Map and passes it
 * explicitly to avoid cross-test pollution.
 *
 * Key: `${userId}:${roomCode}`.
 */
export const defaultSessionStore = new Map<string, SessionEntry>();

/**
 * Module-level socket registry.  Maps socketId -> socket object.
 * Used by handleNewReconnect to find and fence the old socket synchronously.
 * Tests pass their own Map; production code calls registerSocket / unregisterSocket.
 */
export const defaultSocketRegistry = new Map<string, AppSocket>();

export function registerSocket(socket: AppSocket): void {
  defaultSocketRegistry.set(socket.id, socket);
}

export function unregisterSocket(socketId: string): void {
  defaultSocketRegistry.delete(socketId);
}

/**
 * Resets the module-level tokenAttempts counter map.
 * Call this in `beforeEach` for any test suite that exercises handleNewReconnect
 * to prevent cross-test pollution of attempt counts.
 */
export function resetTokenAttempts(): void {
  tokenAttempts.clear();
}

// ── Session helpers ───────────────────────────────────────────────────────────

function sessionKey(userId: string, roomCode: string): string {
  return `${userId}:${roomCode}`;
}

// ── Mint + store a fresh session token ───────────────────────────────────────

/**
 * Generates a fresh sessionId, stores the session entry, mints a resumeToken,
 * and emits `resume-token` to the socket.
 *
 * Call this:
 * - After a player successfully joins a room for the first time.
 * - After a successful reconnect (fresh epoch returned from DB).
 */
export async function issueResumeToken(
  socket: AppSocket,
  roomManager: RoomManager,
  secret: string,
  userId: string,
  roomCode: string,
  matchId: string,
  sessionStore: Map<string, SessionEntry> = defaultSessionStore
): Promise<void> {
  const epoch = await roomManager.incrementEpoch(matchId, userId);
  const sessionId = randomBytes(16).toString("hex");

  sessionStore.set(sessionKey(userId, roomCode), { epoch, sessionId, matchId });

  const token = mintResumeToken(secret, { userId, roomCode, sessionEpoch: epoch, sessionId });
  socket.emit("resume-token", { token });
}

// ── markPlayerDisconnected ────────────────────────────────────────────────────

/**
 * Called when a socket disconnects during a race.
 *
 * New behaviour (P2-7):
 * - Emits `player-disconnected` (not `player-left`) to signal a temporary absence.
 * - Sets a 20 s timer; on expiry emits `player-dropped` and marks DNF.
 * - Does NOT remove the player's seat immediately.
 */
export function markPlayerDisconnected(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager,
  raceController: RaceController,
  roomCode: string,
  userId: string
): void {
  roomManager.disconnectPlayer(roomCode, userId);
  io.to(roomCode).emit("player-disconnected", { userId });

  const timerKey = `${roomCode}:${userId}`;

  // Clear any pre-existing timer to avoid double-firing.
  const existing = disconnectTimers.get(timerKey);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    disconnectTimers.delete(timerKey);

    const currentRoom = roomManager.getRoom(roomCode);
    if (!currentRoom) return;

    const player = currentRoom.players.get(userId);
    // Only fire if still disconnected (not yet reconnected).
    if (!player || player.isConnected) return;

    // Broadcast player-dropped to remaining room members.
    io.to(roomCode).emit("player-dropped", { userId });

    // Remove the player's seat.
    roomManager.removePlayer(roomCode, userId);

    // If all remaining connected players have finished, end the race.
    if (raceController.allPlayersFinished(roomCode)) {
      finishRace(io, roomCode, currentRoom, roomManager, raceController);
    }
  }, RECONNECT_WINDOW_MS);

  disconnectTimers.set(timerKey, timer);
}

// ── handleNewReconnect ────────────────────────────────────────────────────────

/**
 * Spec § 2.3 step 6 — full token-based reconnect protocol.
 *
 * Steps:
 * 1. Verify token HMAC + expiry via verifyResumeToken.
 * 2. Check per-token attempt cap (max 3).
 * 3. Look up (userId, roomCode) session entry; compare epoch.
 * 4. Find the old socket synchronously; call oldSocket.disconnect(true).
 * 5. Remove old socket's registry entry immediately.
 * 6. Call incrementEpoch → new epoch; mint new token.
 * 7. Emit resume-state with full player snapshot.
 * 8. Mark player isConnected=true.
 * 9. Broadcast player-reconnected to room.
 * 10. Cancel the pending DNF timer.
 *
 * @param socketRegistry  Map<socketId, socket> — used to find the old socket.
 * @param sessionStore    Map<userId:roomCode, SessionEntry> — per-session epoch/id.
 */
export async function handleNewReconnect(
  io: AppServer,
  newSocket: AppSocket,
  roomManager: RoomManager,
  raceController: RaceController,
  secret: string,
  token: string,
  socketRegistry: Map<string, AppSocket> = defaultSocketRegistry,
  sessionStore: Map<string, SessionEntry> = defaultSessionStore
): Promise<void> {
  // ── Step 1: Per-token attempt cap (keyed by raw token string, even if
  //    malformed) — must be incremented BEFORE verifyResumeToken so that a
  //    client hammering with garbage tokens cannot bypass the 3-attempt limit.
  const attempts = (tokenAttempts.get(token) ?? 0) + 1;
  tokenAttempts.set(token, attempts);
  if (attempts > MAX_TOKEN_ATTEMPTS) {
    newSocket.emit("reconnect-error", { reason: "token-attempt-cap-exceeded" });
    return;
  }

  // ── Step 2: Verify HMAC + expiry ─────────────────────────────────────────
  const verifyResult = verifyResumeToken(secret, token);
  if (!verifyResult.valid) {
    newSocket.emit("reconnect-error", { reason: verifyResult.reason });
    return;
  }

  const { userId, roomCode, sessionEpoch: tokenEpoch } = verifyResult.payload;

  // ── Step 3: Epoch check ───────────────────────────────────────────────────
  const key = sessionKey(userId, roomCode);
  const entry = sessionStore.get(key);
  if (!entry) {
    newSocket.emit("reconnect-error", { reason: "session-not-found" });
    return;
  }
  if (entry.epoch !== tokenEpoch) {
    newSocket.emit("reconnect-error", { reason: "epoch-mismatch" });
    return;
  }

  // ── Step 3b: Room must exist ───────────────────────────────────────────────
  const room = roomManager.getRoom(roomCode);
  if (!room) {
    newSocket.emit("reconnect-error", { reason: "room-not-found" });
    return;
  }

  // ── Step 4: Find and synchronously fence the old socket ───────────────────
  const player = room.players.get(userId);
  if (player) {
    const oldSocketId = player.socketId;
    if (oldSocketId && oldSocketId !== newSocket.id) {
      const oldSocket = socketRegistry.get(oldSocketId);
      if (oldSocket) {
        // Synchronously tear down the old socket's Socket.IO bindings.
        oldSocket.disconnect(true);
      }
      // Remove old socket from registry immediately — don't wait for its
      // disconnect event to fire (the fence is synchronous by design).
      socketRegistry.delete(oldSocketId);
    }
  }

  // ── Step 5: Increment epoch atomically + mint new token ───────────────────
  const newEpoch = await roomManager.incrementEpoch(entry.matchId, userId);
  const newSessionId = randomBytes(16).toString("hex");
  sessionStore.set(key, { epoch: newEpoch, sessionId: newSessionId, matchId: entry.matchId });

  const newToken = mintResumeToken(secret, {
    userId,
    roomCode,
    sessionEpoch: newEpoch,
    sessionId: newSessionId,
  });

  // Clear the old token's attempt counter (it can no longer be used).
  tokenAttempts.delete(token);

  // ── Step 6: Re-bind the player's seat to the new socket ───────────────────
  roomManager.reconnectPlayer(roomCode, userId, newSocket.id);
  newSocket.data.roomCode = roomCode;
  newSocket.join(roomCode);

  // Register new socket in registry.
  socketRegistry.set(newSocket.id, newSocket);

  // Cancel any pending DNF timer for this player.
  const timerKey = `${roomCode}:${userId}`;
  const pendingTimer = disconnectTimers.get(timerKey);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    disconnectTimers.delete(timerKey);
  }

  // ── Step 7: Build resume-state snapshot ───────────────────────────────────
  const raceElapsedMs = room.raceStartedAt ? Date.now() - room.raceStartedAt : 0;

  // Get per-player charIndex from the race controller's progress snapshot.
  // getProgressSnapshot returns { userId, progress, charIndex } — use charIndex directly.
  const progressSnapshot = raceController.getProgressSnapshot(roomCode);
  const progressByUserId = new Map<string, number>(
    progressSnapshot.map((p) => [p.userId, p.charIndex])
  );

  // Build the full players snapshot (every player in the room).
  const playersSnapshot = Array.from(room.players.values()).map((p) => ({
    userId: p.userId,
    charIndex: progressByUserId.get(p.userId) ?? 0,
    isConnected: p.isConnected,
  }));

  // Alice's own charIndex.
  const myCharIndex = progressByUserId.get(userId) ?? 0;

  newSocket.emit("resume-state", {
    token: newToken,
    charIndex: myCharIndex,
    raceElapsedMs,
    comboCount: 0,          // TODO Phase 5: restore from server-side combo state
    comboPaused: false,     // TODO Phase 5
    comboPausedAtCharIndex: 0, // TODO Phase 5
    players: playersSnapshot,
  });

  // ── Step 8: Mark player connected + broadcast ──────────────────────────────
  // reconnectPlayer already set isConnected=true above.
  io.to(roomCode).emit("player-reconnected", { userId });
}

// ── handleDisconnect (existing — unchanged for waiting room + old racing path) ─

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
    // New P2-7 path: 20 s reconnect window, player-disconnected event.
    markPlayerDisconnected(io, socket, roomManager, raceController, roomCode, userId);
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

// ── emitRoomState ─────────────────────────────────────────────────────────────

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
