import { RoomManager } from "../../src/rooms/room-manager.js";
import { RaceController } from "../../src/race/race-controller.js";
import { ProgressValidator } from "../../src/race/progress-validator.js";
import type { Room } from "../../src/types.js";

// Helper to build ghost data simulating a completed race
function makeGhostData(charCount: number, durationMs: number) {
  const points: Array<{ charIndex: number; ms: number }> = [];
  for (let i = 0; i <= charCount; i += Math.max(1, Math.floor(charCount / 20))) {
    points.push({ charIndex: i, ms: Math.round((i / charCount) * durationMs) });
  }
  // Ensure final point is at the end
  if (points[points.length - 1].charIndex !== charCount) {
    points.push({ charIndex: charCount, ms: durationMs });
  }
  return points;
}

const PASSAGE = {
  id: "test-passage-1",
  text: "The quick brown fox jumps over the lazy dog near the river bank on a warm summer afternoon",
  charCount: 89,
  wordCount: 16,
};

describe("Room Lifecycle Integration", () => {
  let roomManager: RoomManager;
  let raceController: RaceController;
  let timeoutCalls: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    timeoutCalls = [];
    roomManager = new RoomManager();
    raceController = new RaceController((roomCode) => {
      timeoutCalls.push(roomCode);
    });
  });

  afterEach(() => {
    raceController.destroy();
    roomManager.destroy();
    vi.useRealTimers();
  });

  // ─── 1. Room creation and joining ───────────────────────────────────

  describe("Room creation and joining", () => {
    it("should create a room with the host as the only player", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");

      expect(room.status).toBe("waiting");
      expect(room.hostUserId).toBe("host-1");
      expect(room.difficulty).toBe("medium");
      expect(room.players.size).toBe(1);

      const host = room.players.get("host-1")!;
      expect(host.isHost).toBe(true);
      expect(host.username).toBe("Alice");
      expect(host.isConnected).toBe(true);
    });

    it("should allow 2 more players to join and reflect correct state", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");

      const join1 = roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");
      expect(join1.success).toBe(true);
      if (join1.success) {
        expect(join1.room.players.size).toBe(2);
      }

      const join2 = roomManager.joinRoom(room.code, "player-3", "Charlie", "swift", "socket-3");
      expect(join2.success).toBe(true);

      const updatedRoom = roomManager.getRoom(room.code)!;
      expect(updatedRoom.players.size).toBe(3);

      // Non-host players should not be marked as host
      expect(updatedRoom.players.get("player-2")!.isHost).toBe(false);
      expect(updatedRoom.players.get("player-3")!.isHost).toBe(false);
    });

    it("should reject joining a nonexistent room", () => {
      const result = roomManager.joinRoom("FAKE-99", "u1", "User", "robin", "s1");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/not found/i);
      }
    });

    it("should reject duplicate joins", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "short");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");

      const dup = roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2b");
      expect(dup.success).toBe(false);
      if (!dup.success) {
        expect(dup.error).toMatch(/already/i);
      }
    });

    it("should reject joining a full room (6 players)", () => {
      const room = roomManager.createRoom("host", "H", "robin", "s0", "short");
      for (let i = 1; i <= 5; i++) {
        roomManager.joinRoom(room.code, `p${i}`, `P${i}`, "eagle", `s${i}`);
      }
      expect(room.players.size).toBe(6);

      const overflow = roomManager.joinRoom(room.code, "p-extra", "Extra", "owl", "s-extra");
      expect(overflow.success).toBe(false);
      if (!overflow.success) {
        expect(overflow.error).toMatch(/full/i);
      }
    });
  });

  // ─── 2. Race start ─────────────────────────────────────────────────

  describe("Race start", () => {
    it("should transition room to racing and initialize race state", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");

      raceController.startRace(room, PASSAGE);

      expect(room.status).toBe("racing");
      expect(room.passageId).toBe(PASSAGE.id);
      expect(room.passageText).toBe(PASSAGE.text);
      expect(room.passageCharCount).toBe(PASSAGE.charCount);
      expect(room.raceStartedAt).toBeTypeOf("number");
      expect(room.maxDurationMs).toBeGreaterThan(0);
    });

    it("should reject starting with fewer than 2 connected players", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");

      expect(() => raceController.startRace(room, PASSAGE)).toThrow(
        /at least 2 players/i
      );
    });

    it("should reject joining a room that is already racing", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");
      raceController.startRace(room, PASSAGE);

      const lateJoin = roomManager.joinRoom(room.code, "player-3", "Late", "owl", "socket-3");
      expect(lateJoin.success).toBe(false);
      if (!lateJoin.success) {
        expect(lateJoin.error).toMatch(/in progress/i);
      }
    });
  });

  // ─── 3. Progress tracking ──────────────────────────────────────────

  describe("Progress tracking", () => {
    it("should validate monotonically increasing progress", () => {
      const validator = new ProgressValidator(PASSAGE.charCount);

      const r1 = validator.validate("player-1", 10);
      expect(r1.valid).toBe(true);

      const r2 = validator.validate("player-1", 25);
      expect(r2.valid).toBe(true);

      expect(validator.getCharIndex("player-1")).toBe(25);
    });

    it("should reject non-monotonic (backwards) progress", () => {
      const validator = new ProgressValidator(PASSAGE.charCount);
      validator.validate("player-1", 30);

      const backwards = validator.validate("player-1", 20);
      expect(backwards.valid).toBe(false);
      if (!backwards.valid) {
        expect(backwards.reason).toMatch(/monotonically/i);
      }
    });

    it("should reject same charIndex (not strictly increasing)", () => {
      const validator = new ProgressValidator(PASSAGE.charCount);
      validator.validate("player-1", 10);

      const same = validator.validate("player-1", 10);
      expect(same.valid).toBe(false);
      if (!same.valid) {
        expect(same.reason).toMatch(/monotonically/i);
      }
    });

    it("should reject charIndex exceeding passage length", () => {
      const validator = new ProgressValidator(PASSAGE.charCount);

      const overBounds = validator.validate("player-1", PASSAGE.charCount + 1);
      expect(overBounds.valid).toBe(false);
      if (!overBounds.valid) {
        expect(overBounds.reason).toMatch(/exceeds/i);
      }
    });

    it("should accept charIndex equal to passage length", () => {
      const validator = new ProgressValidator(PASSAGE.charCount);
      const atEnd = validator.validate("player-1", PASSAGE.charCount);
      expect(atEnd.valid).toBe(true);
    });

    it("should reject negative charIndex", () => {
      const validator = new ProgressValidator(PASSAGE.charCount);
      const negative = validator.validate("player-1", -1);
      expect(negative.valid).toBe(false);
    });

    it("should rate-limit updates beyond 30 per second", () => {
      const validator = new ProgressValidator(1000);

      // Send 31 updates in the same time window
      for (let i = 1; i <= 30; i++) {
        const r = validator.validate("player-1", i);
        expect(r.valid).toBe(true);
      }

      const over = validator.validate("player-1", 31);
      expect(over.valid).toBe(false);
      if (!over.valid) {
        expect(over.reason).toMatch(/rate limit/i);
      }
    });

    it("should reset rate limit after 1 second", () => {
      const validator = new ProgressValidator(1000);

      for (let i = 1; i <= 30; i++) {
        validator.validate("player-1", i);
      }

      // Advance past the 1-second window
      vi.advanceTimersByTime(1001);

      const afterReset = validator.validate("player-1", 31);
      expect(afterReset.valid).toBe(true);
    });

    it("should track multiple players independently", () => {
      const validator = new ProgressValidator(PASSAGE.charCount);

      validator.validate("player-1", 10);
      validator.validate("player-2", 5);
      validator.validate("player-1", 20);
      validator.validate("player-2", 15);

      expect(validator.getCharIndex("player-1")).toBe(20);
      expect(validator.getCharIndex("player-2")).toBe(15);
    });

    it("should integrate with RaceController progress snapshot", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");
      raceController.startRace(room, PASSAGE);

      raceController.updateCharIndex(room.code, "host-1", 40);
      raceController.updateCharIndex(room.code, "player-2", 20);

      const snapshot = raceController.getProgressSnapshot(room.code);
      expect(snapshot).toHaveLength(2);

      const hostProgress = snapshot.find((s) => s.userId === "host-1")!;
      const p2Progress = snapshot.find((s) => s.userId === "player-2")!;

      expect(hostProgress.progress).toBeCloseTo(40 / PASSAGE.charCount, 5);
      expect(p2Progress.progress).toBeCloseTo(20 / PASSAGE.charCount, 5);
    });
  });

  // ─── 4. Player finish ──────────────────────────────────────────────

  describe("Player finish", () => {
    it("should assign placement and calculate WPM", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");
      raceController.startRace(room, PASSAGE);

      const ghostData = makeGhostData(PASSAGE.charCount, 15000); // 15 seconds

      const result = raceController.playerFinished(room.code, "host-1", {
        ghostData,
        correctKeystrokes: 85,
        totalKeystrokes: 89,
      });

      expect(result).not.toBeNull();
      expect(result!.placement).toBe(1);
      expect(result!.wpm).toBeGreaterThan(0);
      expect(result!.accuracy).toBeCloseTo(85 / 89, 5);
    });

    it("should reject finishing the same player twice", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");
      raceController.startRace(room, PASSAGE);

      const ghostData = makeGhostData(PASSAGE.charCount, 12000);
      raceController.playerFinished(room.code, "host-1", {
        ghostData,
        correctKeystrokes: 89,
        totalKeystrokes: 89,
      });

      const duplicate = raceController.playerFinished(room.code, "host-1", {
        ghostData,
        correctKeystrokes: 89,
        totalKeystrokes: 89,
      });
      expect(duplicate).toBeNull();
    });

    it("should assign incrementing placements", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");
      roomManager.joinRoom(room.code, "player-3", "Charlie", "swift", "socket-3");
      raceController.startRace(room, PASSAGE);

      const ghost1 = makeGhostData(PASSAGE.charCount, 10000);
      const ghost2 = makeGhostData(PASSAGE.charCount, 12000);
      const ghost3 = makeGhostData(PASSAGE.charCount, 15000);

      const r1 = raceController.playerFinished(room.code, "player-3", {
        ghostData: ghost1,
        correctKeystrokes: 89,
        totalKeystrokes: 89,
      });
      const r2 = raceController.playerFinished(room.code, "host-1", {
        ghostData: ghost2,
        correctKeystrokes: 85,
        totalKeystrokes: 89,
      });
      const r3 = raceController.playerFinished(room.code, "player-2", {
        ghostData: ghost3,
        correctKeystrokes: 80,
        totalKeystrokes: 89,
      });

      expect(r1!.placement).toBe(1);
      expect(r2!.placement).toBe(2);
      expect(r3!.placement).toBe(3);
    });
  });

  // ─── 5. All players finish ─────────────────────────────────────────

  describe("All players finish", () => {
    it("should detect when all players have finished", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");
      raceController.startRace(room, PASSAGE);

      expect(raceController.allPlayersFinished(room.code)).toBe(false);

      const ghost = makeGhostData(PASSAGE.charCount, 12000);
      raceController.playerFinished(room.code, "host-1", {
        ghostData: ghost,
        correctKeystrokes: 89,
        totalKeystrokes: 89,
      });
      expect(raceController.allPlayersFinished(room.code)).toBe(false);

      raceController.playerFinished(room.code, "player-2", {
        ghostData: ghost,
        correctKeystrokes: 80,
        totalKeystrokes: 89,
      });
      expect(raceController.allPlayersFinished(room.code)).toBe(true);
    });

    it("should produce correct rankings when all finish", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");
      raceController.startRace(room, PASSAGE);

      const fastGhost = makeGhostData(PASSAGE.charCount, 8000);
      const slowGhost = makeGhostData(PASSAGE.charCount, 20000);

      raceController.playerFinished(room.code, "player-2", {
        ghostData: fastGhost,
        correctKeystrokes: 89,
        totalKeystrokes: 89,
      });
      raceController.playerFinished(room.code, "host-1", {
        ghostData: slowGhost,
        correctKeystrokes: 80,
        totalKeystrokes: 89,
      });

      const rankings = raceController.getRankings(room.code, room);
      expect(rankings).toHaveLength(2);

      expect(rankings[0].userId).toBe("player-2");
      expect(rankings[0].placement).toBe(1);
      expect(rankings[0].status).toBe("finished");
      expect(rankings[0].username).toBe("Bob");
      expect(rankings[0].wpm).toBeGreaterThan(0);

      expect(rankings[1].userId).toBe("host-1");
      expect(rankings[1].placement).toBe(2);
      expect(rankings[1].status).toBe("finished");
    });
  });

  // ─── 6. DNF scenario ───────────────────────────────────────────────

  describe("DNF scenario", () => {
    it("should mark unfinished players as DNF in rankings", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");
      roomManager.joinRoom(room.code, "player-3", "Charlie", "swift", "socket-3");
      raceController.startRace(room, PASSAGE);

      // Only player-2 finishes
      const ghost = makeGhostData(PASSAGE.charCount, 10000);
      raceController.playerFinished(room.code, "player-2", {
        ghostData: ghost,
        correctKeystrokes: 89,
        totalKeystrokes: 89,
      });

      expect(raceController.allPlayersFinished(room.code)).toBe(false);

      const rankings = raceController.getRankings(room.code, room);
      expect(rankings).toHaveLength(3);

      // First entry: the finisher
      const finisher = rankings.find((r) => r.userId === "player-2")!;
      expect(finisher.placement).toBe(1);
      expect(finisher.status).toBe("finished");
      expect(finisher.wpm).toBeGreaterThan(0);
      expect(finisher.accuracy).toBeGreaterThan(0);

      // Remaining entries: DNFs
      const dnfs = rankings.filter((r) => r.status === "dnf");
      expect(dnfs).toHaveLength(2);
      for (const dnf of dnfs) {
        expect(dnf.wpm).toBeNull();
        expect(dnf.accuracy).toBeNull();
      }
    });

    it("should fire the timeout callback after countdown + max duration", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");
      raceController.startRace(room, PASSAGE);

      expect(timeoutCalls).toHaveLength(0);

      // maxDurationMs = (charCount / 2) * 1000 + 30000
      // timeout = 3000 (countdown) + maxDurationMs
      const expectedTimeout = 3000 + (PASSAGE.charCount / 2) * 1000 + 30000;
      vi.advanceTimersByTime(expectedTimeout);

      expect(timeoutCalls).toHaveLength(1);
      expect(timeoutCalls[0]).toBe(room.code);
    });
  });

  // ─── 7. Room expiry ────────────────────────────────────────────────

  describe("Room expiry", () => {
    it("should clean up rooms inactive for more than 10 minutes", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "short");
      const code = room.code;

      expect(roomManager.getRoom(code)).toBeDefined();

      // Advance past 10-minute expiry
      vi.advanceTimersByTime(10 * 60 * 1000 + 1);

      roomManager.cleanupExpiredRooms();

      expect(roomManager.getRoom(code)).toBeUndefined();
    });

    it("should not clean up rooms with recent activity", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "short");
      const code = room.code;

      // Advance 9 minutes
      vi.advanceTimersByTime(9 * 60 * 1000);
      roomManager.touchRoom(code);

      // Advance another 9 minutes (18 min total, but only 9 since last touch)
      vi.advanceTimersByTime(9 * 60 * 1000);
      roomManager.cleanupExpiredRooms();

      expect(roomManager.getRoom(code)).toBeDefined();
    });

    it("should auto-cleanup via the interval timer", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "short");
      const code = room.code;

      // Advance past expiry + cleanup interval (10 min + 60s)
      vi.advanceTimersByTime(10 * 60 * 1000 + 60 * 1000 + 1);

      expect(roomManager.getRoom(code)).toBeUndefined();
    });
  });

  // ─── 8. Host transfer ──────────────────────────────────────────────

  describe("Host transfer", () => {
    it("should transfer host to the next player when host leaves during waiting", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");
      roomManager.joinRoom(room.code, "player-3", "Charlie", "swift", "socket-3");

      const result = roomManager.removePlayer(room.code, "host-1");

      expect(result).not.toBeNull();
      expect(result!.removed).toBe(true);
      expect(result!.roomDeleted).toBe(false);
      expect(result!.newHostUserId).toBe("player-2");

      const updatedRoom = roomManager.getRoom(room.code)!;
      expect(updatedRoom.hostUserId).toBe("player-2");
      expect(updatedRoom.players.get("player-2")!.isHost).toBe(true);
      expect(updatedRoom.players.size).toBe(2);
    });

    it("should delete the room when the last player leaves", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      const code = room.code;

      const result = roomManager.removePlayer(code, "host-1");
      expect(result!.roomDeleted).toBe(true);
      expect(roomManager.getRoom(code)).toBeUndefined();
    });

    it("should not transfer host when a non-host leaves", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");

      const result = roomManager.removePlayer(room.code, "player-2");
      expect(result!.newHostUserId).toBeNull();
      expect(roomManager.getRoom(room.code)!.hostUserId).toBe("host-1");
    });
  });

  // ─── 9. Disconnect / reconnect ─────────────────────────────────────

  describe("Disconnect and reconnect", () => {
    it("should mark a player as disconnected", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");

      roomManager.disconnectPlayer(room.code, "player-2");

      const player = room.players.get("player-2")!;
      expect(player.isConnected).toBe(false);
      expect(player.disconnectedAt).toBeTypeOf("number");
    });

    it("should restore a disconnected player with a new socketId", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");

      roomManager.disconnectPlayer(room.code, "player-2");
      const reconnected = roomManager.reconnectPlayer(room.code, "player-2", "socket-2-new");

      expect(reconnected).toBe(true);

      const player = room.players.get("player-2")!;
      expect(player.isConnected).toBe(true);
      expect(player.socketId).toBe("socket-2-new");
      expect(player.disconnectedAt).toBeNull();
    });

    it("should return false when reconnecting to a nonexistent room", () => {
      const result = roomManager.reconnectPlayer("FAKE-99", "player-1", "socket-new");
      expect(result).toBe(false);
    });

    it("should return false when reconnecting a player not in the room", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      const result = roomManager.reconnectPlayer(room.code, "unknown-player", "socket-new");
      expect(result).toBe(false);
    });

    it("should find a room by socket ID before and after reconnect", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");

      expect(roomManager.getRoomBySocketId("socket-1")?.code).toBe(room.code);

      roomManager.disconnectPlayer(room.code, "host-1");
      roomManager.reconnectPlayer(room.code, "host-1", "socket-1-new");

      expect(roomManager.getRoomBySocketId("socket-1-new")?.code).toBe(room.code);
      // Old socket ID should no longer match
      expect(roomManager.getRoomBySocketId("socket-1")).toBeUndefined();
    });

    it("should count disconnected players as not connected for race start", () => {
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");
      roomManager.disconnectPlayer(room.code, "player-2");

      // Only 1 connected player, so race should not start
      expect(() => raceController.startRace(room, PASSAGE)).toThrow(
        /at least 2 players/i
      );
    });
  });

  // ─── Full lifecycle smoke test ──────────────────────────────────────

  describe("Full lifecycle end-to-end", () => {
    it("should support create -> join -> race -> finish -> rankings", () => {
      // Create and join
      const room = roomManager.createRoom("host-1", "Alice", "robin", "socket-1", "medium");
      roomManager.joinRoom(room.code, "player-2", "Bob", "eagle", "socket-2");
      expect(room.status).toBe("waiting");
      expect(room.players.size).toBe(2);

      // Start race
      raceController.startRace(room, PASSAGE);
      expect(room.status).toBe("racing");

      // Validate progress
      const validator = new ProgressValidator(PASSAGE.charCount);
      expect(validator.validate("host-1", 20).valid).toBe(true);
      expect(validator.validate("player-2", 10).valid).toBe(true);
      expect(validator.validate("host-1", 50).valid).toBe(true);
      expect(validator.validate("player-2", 40).valid).toBe(true);

      // Update race controller with validated indices
      raceController.updateCharIndex(room.code, "host-1", 50);
      raceController.updateCharIndex(room.code, "player-2", 40);

      // Player 2 finishes first
      const ghost2 = makeGhostData(PASSAGE.charCount, 10000);
      const finish2 = raceController.playerFinished(room.code, "player-2", {
        ghostData: ghost2,
        correctKeystrokes: 88,
        totalKeystrokes: 89,
      });
      expect(finish2!.placement).toBe(1);
      expect(raceController.allPlayersFinished(room.code)).toBe(false);

      // Host finishes second
      const ghost1 = makeGhostData(PASSAGE.charCount, 14000);
      const finish1 = raceController.playerFinished(room.code, "host-1", {
        ghostData: ghost1,
        correctKeystrokes: 85,
        totalKeystrokes: 89,
      });
      expect(finish1!.placement).toBe(2);
      expect(raceController.allPlayersFinished(room.code)).toBe(true);

      // Get rankings
      const rankings = raceController.getRankings(room.code, room);
      expect(rankings).toHaveLength(2);
      expect(rankings[0].userId).toBe("player-2");
      expect(rankings[0].status).toBe("finished");
      expect(rankings[0].wpm).toBeGreaterThan(rankings[1].wpm!);
      expect(rankings[1].userId).toBe("host-1");
      expect(rankings[1].status).toBe("finished");

      // Mark race as completed
      roomManager.setRoomStatus(room.code, "completed");
      expect(room.status).toBe("completed");

      // Cleanup race state
      raceController.cleanupRace(room.code);
      expect(raceController.getProgressSnapshot(room.code)).toHaveLength(0);
    });
  });
});
