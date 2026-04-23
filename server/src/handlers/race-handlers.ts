// Prisma types
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types.js";
import type { RoomManager } from "../rooms/room-manager.js";
import type { RaceController } from "../race/race-controller.js";
import { ProgressValidator } from "../race/progress-validator.js";
import { runAllChecks, bucketsFromGhost } from "../race/cheat-detector.js";
import { prisma } from "../lib/prisma.js";
import { issueResumeToken } from "./connection-handler.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// One progress validator per active race
const progressValidators = new Map<string, ProgressValidator>();

export function registerRaceHandlers(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager,
  raceController: RaceController,
  secret: string
): void {
  socket.on("start-race", async ({ roomCode }) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) {
      socket.emit("room-error", { message: "Room not found" });
      return;
    }

    // Verify sender is the host
    let hostPlayer = null;
    for (const p of room.players.values()) {
      if (p.socketId === socket.id) {
        hostPlayer = p;
        break;
      }
    }
    if (!hostPlayer) {
      socket.emit("room-error", { message: "Not in this room" });
      return;
    }
    if (!hostPlayer.isHost) {
      socket.emit("room-error", { message: "Only the host can start the race" });
      return;
    }

    if (room.status !== "waiting") {
      socket.emit("room-error", { message: "Race already started" });
      return;
    }

    const connectedCount = Array.from(room.players.values()).filter(
      (p) => p.isConnected
    ).length;
    if (connectedCount < 2) {
      socket.emit("room-error", { message: "Need at least 2 players to start" });
      return;
    }

    // Fetch a random passage matching the difficulty
    const passage = await prisma.passage.findFirst({
      where: { difficulty: room.difficulty },
      orderBy: { id: "asc" },
      skip: Math.floor(
        Math.random() *
          (await prisma.passage.count({ where: { difficulty: room.difficulty } }))
      ),
    });

    if (!passage) {
      socket.emit("room-error", { message: "No passages available for this difficulty" });
      return;
    }

    // Create Match record in DB
    const match = await prisma.match.create({
      data: {
        roomCode,
        passageId: passage.id,
        status: "racing",
        startedAt: new Date(),
      },
    });

    // Create MatchPlayer records for all connected players
    const connectedPlayers = Array.from(room.players.values()).filter(
      (p) => p.isConnected
    );
    await prisma.matchPlayer.createMany({
      data: connectedPlayers.map((p) => ({
        matchId: match.id,
        userId: p.userId,
        status: "racing" as const,
      })),
    });

    // Start the race in controller
    raceController.startRace(room, {
      id: passage.id,
      text: passage.text,
      charCount: passage.charCount,
      wordCount: passage.wordCount,
    });

    // Set up progress validator
    progressValidators.set(roomCode, new ProgressValidator(passage.charCount));

    // Set up 10Hz progress broadcast — include charIndex + serverTime so
    // the client interpolation path (P2-12) can build its sample buffer.
    room.progressBroadcastInterval = setInterval(() => {
      const snapshot = raceController.getProgressSnapshot(roomCode);
      if (snapshot.length > 0) {
        const serverTime = performance.now();
        io.to(roomCode).emit("player-progress", {
          players: snapshot.map((p) => ({ ...p, serverTime })),
        });
      }
    }, 100);

    // Emit race start to all players in the room
    io.to(roomCode).emit("race-started", {
      passage: {
        id: passage.id,
        text: passage.text,
        charCount: passage.charCount,
        wordCount: passage.wordCount,
      },
      countdownMs: 3000,
    });

    // CRITICAL 2 (Spec § 2.3 step 1): Mint + emit resume-token to every
    // connected player so they can survive a disconnect during the race.
    // We do this here (not at join-room) because matchId is only known
    // once the Match record has been created by start-race.
    const sockets = await io.in(roomCode).fetchSockets();
    const socketById = new Map(sockets.map((s) => [s.id, s]));

    await Promise.all(
      connectedPlayers.map(async (player) => {
        const playerSocket = socketById.get(player.socketId);
        if (!playerSocket) return;
        try {
          await issueResumeToken(
            playerSocket as any,
            roomManager,
            secret,
            player.userId,
            roomCode,
            match.id,
          );
        } catch (err) {
          console.error(`[start-race] Failed to issue resume token for ${player.userId}:`, err);
        }
      })
    );
  });

  socket.on("typing-progress", ({ charIndex }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const room = roomManager.getRoom(roomCode);
    if (!room || room.status !== "racing") return;

    const validator = progressValidators.get(roomCode);
    if (!validator) return;

    // Find userId by socket id
    let userId: string | null = null;
    for (const p of room.players.values()) {
      if (p.socketId === socket.id) {
        userId = p.userId;
        break;
      }
    }
    if (!userId) return;

    const result = validator.validate(userId, charIndex);
    if (!result.valid) return; // Silently drop invalid progress

    raceController.updateCharIndex(roomCode, userId, charIndex);
    roomManager.touchRoom(roomCode);
  });

  socket.on("player-finished", async ({ ghostData, correctKeystrokes, totalKeystrokes }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const room = roomManager.getRoom(roomCode);
    if (!room || room.status !== "racing") return;
    if (!room.raceStartedAt) return;

    // Find userId by socket id
    let userId: string | null = null;
    for (const p of room.players.values()) {
      if (p.socketId === socket.id) {
        userId = p.userId;
        break;
      }
    }
    if (!userId) return;

    // Basic validation on keystroke counts
    if (correctKeystrokes < 0 || totalKeystrokes < 0 || correctKeystrokes > totalKeystrokes) return;

    const finishResult = raceController.playerFinished(roomCode, userId, {
      ghostData,
      correctKeystrokes,
      totalKeystrokes,
    });

    if (!finishResult) return;

    // Update MatchPlayer record in DB
    const match = await prisma.match.findUnique({ where: { roomCode } });
    if (match) {
      const finishedData = raceController.getFinishedPlayerData(roomCode, userId);
      const serverGhost = finishedData?.serverGhost ?? [];

      // Phase 4 — Run post-race anti-cheat checks. All checks currently
      // ship at LOG level; corpus calibration showed ≥95% precision but
      // promotion to INVALIDATE is gated on a week of real-world data
      // per spec § 2.1.3. Violations are persisted to CheatViolation.
      const checkResults = runAllChecks({
        serverGhost,
        updateBuckets: bucketsFromGhost(serverGhost),
        wpm: finishResult.wpm,
      });
      const triggered = checkResults.filter((r) => r.triggered).slice(0, 5); // per-match cap
      for (const r of triggered) {
        try {
          await prisma.cheatViolation.create({
            data: {
              userId,
              matchId: match.id,
              check: r.check,
              numericValue: r.numericValue,
              action: "LOG",
            },
          });
        } catch (err) {
          console.error(`[cheat-detector] Failed to log ${r.check} for ${userId}:`, err);
        }
      }

      await prisma.matchPlayer.updateMany({
        where: { matchId: match.id, userId },
        data: {
          wpm: finishResult.wpm,
          accuracy: finishResult.accuracy,
          placement: finishResult.placement,
          clientGhostData: ghostData as never,
          serverGhost: serverGhost as never,
          flagged: false, // LOG-only — promotion to INVALIDATE is future work
          status: "finished",
          finishedAt: new Date(),
        },
      });
    }

    // Check if all players finished
    if (raceController.allPlayersFinished(roomCode)) {
      finishRace(io, roomCode, room, roomManager, raceController);
    }
  });
}

export async function finishRace(
  io: AppServer,
  roomCode: string,
  room: NonNullable<ReturnType<RoomManager["getRoom"]>>,
  roomManager: RoomManager,
  raceController: RaceController,
  isTimeout = false
): Promise<void> {
  // Clear timers
  if (room.raceTimeoutTimer) {
    clearTimeout(room.raceTimeoutTimer);
    room.raceTimeoutTimer = null;
  }
  if (room.progressBroadcastInterval) {
    clearInterval(room.progressBroadcastInterval);
    room.progressBroadcastInterval = null;
  }

  const rankings = raceController.getRankings(roomCode, room);

  // Update match status in DB
  await prisma.match.update({
    where: { roomCode },
    data: { status: "completed" },
  });

  // Update DNF players in DB
  const match = await prisma.match.findUnique({ where: { roomCode } });
  if (match) {
    for (const ranking of rankings) {
      if (ranking.status === "dnf") {
        await prisma.matchPlayer.updateMany({
          where: { matchId: match.id, userId: ranking.userId },
          data: { status: "abandoned" },
        });
      }
    }
  }

  room.status = "completed";
  roomManager.setRoomStatus(roomCode, "completed");

  if (isTimeout) {
    io.to(roomCode).emit("race-timeout", { rankings });
  } else {
    io.to(roomCode).emit("race-results", { rankings });
  }

  // Cleanup race state
  progressValidators.delete(roomCode);
  raceController.cleanupRace(roomCode);
}

export { progressValidators };
