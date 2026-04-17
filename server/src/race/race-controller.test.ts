import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RaceController } from "./race-controller.js";
import type { Room, RoomPlayer, RaceRanking } from "../types.js";

function createMockRoom(overrides: Partial<Room> = {}): Room {
  const players = new Map<string, RoomPlayer>();
  players.set("user1", {
    userId: "user1",
    username: "alice",
    displayBird: "robin",
    socketId: "sock1",
    isHost: true,
    isConnected: true,
    disconnectedAt: null,
  });
  players.set("user2", {
    userId: "user2",
    username: "bob",
    displayBird: "canary",
    socketId: "sock2",
    isHost: false,
    isConnected: true,
    disconnectedAt: null,
  });

  return {
    code: "ABC123",
    status: "waiting",
    hostUserId: "user1",
    difficulty: "medium",
    players,
    passageId: null,
    passageText: null,
    passageCharCount: null,
    raceStartedAt: null,
    maxDurationMs: null,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    raceTimeoutTimer: null,
    progressBroadcastInterval: null,
    ...overrides,
  };
}

describe("RaceController", () => {
  let controller: RaceController;
  let onRaceTimeout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    onRaceTimeout = vi.fn();
    controller = new RaceController(onRaceTimeout);
  });

  afterEach(() => {
    controller.destroy();
    vi.useRealTimers();
  });

  describe("startRace", () => {
    it("initializes race state on the room", () => {
      const room = createMockRoom();
      const passage = {
        id: "passage1",
        text: "The quick brown fox",
        charCount: 19,
        wordCount: 4,
      };

      controller.startRace(room, passage);

      expect(room.status).toBe("racing");
      expect(room.passageId).toBe("passage1");
      expect(room.passageText).toBe("The quick brown fox");
      expect(room.passageCharCount).toBe(19);
      expect(room.raceStartedAt).toBe(Date.now());
      // maxDurationMs = (charCount / 2) * 1000 + 30000
      expect(room.maxDurationMs).toBe((19 / 2) * 1000 + 30000);
    });

    it("sets up a race timeout timer", () => {
      const room = createMockRoom();
      const passage = { id: "p1", text: "Hello world", charCount: 11, wordCount: 2 };

      controller.startRace(room, passage);

      expect(room.raceTimeoutTimer).not.toBeNull();
      // Advance past timeout: (11/2)*1000 + 30000 = 35500ms + 3000ms countdown
      vi.advanceTimersByTime(35500 + 3000 + 1);
      expect(onRaceTimeout).toHaveBeenCalledWith(room.code);
    });

    it("rejects starting race with fewer than 2 players", () => {
      const room = createMockRoom();
      room.players.delete("user2");
      const passage = { id: "p1", text: "Hello", charCount: 5, wordCount: 1 };

      expect(() => controller.startRace(room, passage)).toThrow(
        "Need at least 2 players to start"
      );
    });
  });

  describe("playerFinished", () => {
    it("records a player's finish and returns placement", () => {
      const room = createMockRoom({ status: "racing", raceStartedAt: Date.now() });
      const passage = { id: "p1", text: "Hello world", charCount: 11, wordCount: 2 };
      controller.startRace(room, passage);

      const result = controller.playerFinished(room.code, "user1", {
        ghostData: [
          { charIndex: 0, ms: 0 },
          { charIndex: 11, ms: 6000 },
        ],
        correctKeystrokes: 11,
        totalKeystrokes: 12,
      });

      expect(result?.placement).toBe(1);
      expect(result?.wpm).toBe(20); // 2 words / 6000ms * 60000
    });

    it("returns placement 2 for the second finisher", () => {
      const room = createMockRoom({ status: "racing", raceStartedAt: Date.now() });
      const passage = { id: "p1", text: "Hello world", charCount: 11, wordCount: 2 };
      controller.startRace(room, passage);

      controller.playerFinished(room.code, "user1", {
        ghostData: [{ charIndex: 0, ms: 0 }, { charIndex: 11, ms: 5000 }],
        correctKeystrokes: 11,
        totalKeystrokes: 11,
      });

      const result = controller.playerFinished(room.code, "user2", {
        ghostData: [{ charIndex: 0, ms: 0 }, { charIndex: 11, ms: 8000 }],
        correctKeystrokes: 10,
        totalKeystrokes: 11,
      });

      expect(result?.placement).toBe(2);
    });

    it("returns null if race not found", () => {
      const result = controller.playerFinished("BADCODE", "user1", {
        ghostData: [],
        correctKeystrokes: 0,
        totalKeystrokes: 0,
      });
      expect(result).toBeNull();
    });
  });

  describe("allPlayersFinished", () => {
    it("returns true when all connected players have finished", () => {
      const room = createMockRoom({ status: "racing", raceStartedAt: Date.now() });
      const passage = { id: "p1", text: "Hello world", charCount: 11, wordCount: 2 };
      controller.startRace(room, passage);

      const finishData = {
        ghostData: [{ charIndex: 0, ms: 0 }, { charIndex: 11, ms: 5000 }],
        correctKeystrokes: 11,
        totalKeystrokes: 11,
      };

      controller.playerFinished(room.code, "user1", finishData);
      expect(controller.allPlayersFinished(room.code)).toBe(false);

      controller.playerFinished(room.code, "user2", finishData);
      expect(controller.allPlayersFinished(room.code)).toBe(true);
    });
  });

  describe("getRankings", () => {
    it("returns rankings with DNF for unfinished players", () => {
      const room = createMockRoom({ status: "racing", raceStartedAt: Date.now() });
      const passage = { id: "p1", text: "Hello world", charCount: 11, wordCount: 2 };
      controller.startRace(room, passage);

      controller.playerFinished(room.code, "user1", {
        ghostData: [{ charIndex: 0, ms: 0 }, { charIndex: 11, ms: 5000 }],
        correctKeystrokes: 11,
        totalKeystrokes: 11,
      });

      const rankings = controller.getRankings(room.code, room);
      expect(rankings).toHaveLength(2);
      expect(rankings[0].userId).toBe("user1");
      expect(rankings[0].status).toBe("finished");
      expect(rankings[0].placement).toBe(1);
      expect(rankings[1].userId).toBe("user2");
      expect(rankings[1].status).toBe("dnf");
      expect(rankings[1].wpm).toBeNull();
    });
  });

  describe("getProgressSnapshot", () => {
    it("returns progress for all players as fraction of passage", () => {
      const room = createMockRoom({ status: "racing", passageCharCount: 100 });
      const passage = { id: "p1", text: "x".repeat(100), charCount: 100, wordCount: 20 };
      controller.startRace(room, passage);

      // Simulate progress
      controller.updateCharIndex(room.code, "user1", 50);
      controller.updateCharIndex(room.code, "user2", 25);

      const snapshot = controller.getProgressSnapshot(room.code);
      expect(snapshot).toEqual([
        { userId: "user1", progress: 0.5 },
        { userId: "user2", progress: 0.25 },
      ]);
    });
  });
});

function makeRoom(userIds: string[]): Room {
  const players = new Map<string, RoomPlayer>();
  userIds.forEach((userId, i) => {
    players.set(userId, {
      userId,
      username: userId,
      displayBird: "robin",
      socketId: `sock${i}`,
      isHost: i === 0,
      isConnected: true,
      disconnectedAt: null,
    });
  });
  return {
    code: "TEST01",
    status: "waiting",
    hostUserId: userIds[0],
    difficulty: "medium",
    players,
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
}

describe("RaceController serverGhost", () => {
  let controller: RaceController;

  beforeEach(() => {
    controller = new RaceController(() => {});
  });

  afterEach(() => {
    controller.destroy();
  });

  it("records a serverGhost sample on every updateCharIndex with monotonic serverMs", async () => {
    const room = makeRoom(["alice", "bob"]);
    controller.startRace(room, { id: "p1", text: "hello world", charCount: 11, wordCount: 2 });

    controller.updateCharIndex(room.code, "alice", 1);
    await new Promise((r) => setTimeout(r, 5));
    controller.updateCharIndex(room.code, "alice", 3);

    const samples = controller.getServerGhost(room.code, "alice");
    expect(samples).toHaveLength(2);
    expect(samples[0].charIndex).toBe(1);
    expect(samples[1].charIndex).toBe(3);
    expect(samples[1].serverMs).toBeGreaterThan(samples[0].serverMs);
  });
});
