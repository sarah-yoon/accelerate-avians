import { registerRaceHandlers, finishRace, progressValidators } from "./race-handlers.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    passage: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    match: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    matchPlayer: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("../race/progress-validator.js", () => {
  return {
    ProgressValidator: vi.fn().mockImplementation(() => ({
      validate: vi.fn().mockReturnValue({ valid: true }),
    })),
  };
});

import { prisma } from "../lib/prisma.js";
const mockPrisma = vi.mocked(prisma, true);

function createMockSocket(overrides: Record<string, unknown> = {}) {
  const handlers = new Map<string, Function>();
  return {
    id: "sock-host",
    data: { userId: "clerk_1", username: "alice", displayBird: "robin", roomCode: "ROOM1" } as Record<string, unknown>,
    handshake: { auth: { token: "valid-token" } },
    on: vi.fn((event: string, handler: Function) => handlers.set(event, handler)),
    emit: vi.fn(),
    join: vi.fn(),
    ...overrides,
    _trigger: (event: string, ...args: any[]) => handlers.get(event)?.(...args),
  };
}

function createMockIo() {
  const emitFn = vi.fn();
  return {
    to: vi.fn(() => ({ emit: emitFn })),
    _emitFn: emitFn,
  };
}

function createMockRoomManager() {
  return {
    getRoom: vi.fn(),
    touchRoom: vi.fn(),
    setRoomStatus: vi.fn(),
    removePlayer: vi.fn(),
  };
}

function createMockRaceController() {
  return {
    startRace: vi.fn(),
    updateCharIndex: vi.fn(),
    playerFinished: vi.fn(),
    allPlayersFinished: vi.fn(),
    getProgressSnapshot: vi.fn().mockReturnValue([]),
    getRankings: vi.fn().mockReturnValue([]),
    cleanupRace: vi.fn(),
    getFinishedPlayerData: vi.fn().mockReturnValue(null),
  };
}

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    code: "ROOM1",
    status: "waiting",
    hostUserId: "user_1",
    difficulty: "medium",
    passageId: null,
    passageText: null,
    passageCharCount: null,
    raceStartedAt: null,
    maxDurationMs: null,
    raceTimeoutTimer: null,
    progressBroadcastInterval: null,
    players: new Map([
      ["user_1", { userId: "user_1", username: "alice", displayBird: "eagle", socketId: "sock-host", isHost: true, isConnected: true }],
      ["user_2", { userId: "user_2", username: "bob", displayBird: "robin", socketId: "sock-2", isHost: false, isConnected: true }],
    ]),
    ...overrides,
  };
}

describe("registerRaceHandlers", () => {
  let socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let roomManager: ReturnType<typeof createMockRoomManager>;
  let raceController: ReturnType<typeof createMockRaceController>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    progressValidators.clear();
    socket = createMockSocket();
    io = createMockIo();
    roomManager = createMockRoomManager();
    raceController = createMockRaceController();
    registerRaceHandlers(io as any, socket as any, roomManager as any, raceController as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("start-race", () => {
    it("emits room-error when room not found", async () => {
      roomManager.getRoom.mockReturnValue(undefined);

      await socket._trigger("start-race", { roomCode: "ROOM1" });

      expect(socket.emit).toHaveBeenCalledWith("room-error", { message: "Room not found" });
    });

    it("emits room-error when sender is not in the room", async () => {
      const room = makeRoom();
      // Remove the host so socket.id won't match any player
      room.players.clear();
      roomManager.getRoom.mockReturnValue(room);

      await socket._trigger("start-race", { roomCode: "ROOM1" });

      expect(socket.emit).toHaveBeenCalledWith("room-error", { message: "Not in this room" });
    });

    it("emits room-error when sender is not the host", async () => {
      const room = makeRoom();
      // Make the socket's player non-host
      room.players.get("user_1")!.isHost = false;
      roomManager.getRoom.mockReturnValue(room);

      await socket._trigger("start-race", { roomCode: "ROOM1" });

      expect(socket.emit).toHaveBeenCalledWith("room-error", { message: "Only the host can start the race" });
    });

    it("emits room-error when room is not in waiting state", async () => {
      const room = makeRoom({ status: "racing" });
      roomManager.getRoom.mockReturnValue(room);

      await socket._trigger("start-race", { roomCode: "ROOM1" });

      expect(socket.emit).toHaveBeenCalledWith("room-error", { message: "Race already started" });
    });

    it("emits room-error when fewer than 2 connected players", async () => {
      const room = makeRoom();
      room.players.get("user_2")!.isConnected = false;
      roomManager.getRoom.mockReturnValue(room);

      await socket._trigger("start-race", { roomCode: "ROOM1" });

      expect(socket.emit).toHaveBeenCalledWith("room-error", { message: "Need at least 2 players to start" });
    });

    it("emits room-error when no passage found", async () => {
      const room = makeRoom();
      roomManager.getRoom.mockReturnValue(room);
      mockPrisma.passage.count.mockResolvedValue(1);
      mockPrisma.passage.findFirst.mockResolvedValue(null);

      await socket._trigger("start-race", { roomCode: "ROOM1" });

      expect(socket.emit).toHaveBeenCalledWith("room-error", {
        message: "No passages available for this difficulty",
      });
    });

    it("starts race successfully", async () => {
      const room = makeRoom();
      roomManager.getRoom.mockReturnValue(room);

      const passage = { id: "p1", text: "Hello world", charCount: 11, wordCount: 2, difficulty: "medium" };
      mockPrisma.passage.count.mockResolvedValue(1);
      mockPrisma.passage.findFirst.mockResolvedValue(passage as any);

      const match = { id: "match_1" };
      mockPrisma.match.create.mockResolvedValue(match as any);
      mockPrisma.matchPlayer.createMany.mockResolvedValue({ count: 2 } as any);

      await socket._trigger("start-race", { roomCode: "ROOM1" });

      // Creates match in DB
      expect(mockPrisma.match.create).toHaveBeenCalledWith({
        data: {
          roomCode: "ROOM1",
          passageId: "p1",
          status: "racing",
          startedAt: expect.any(Date),
        },
      });

      // Creates match players
      expect(mockPrisma.matchPlayer.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ matchId: "match_1", userId: "user_1", status: "racing" }),
          expect.objectContaining({ matchId: "match_1", userId: "user_2", status: "racing" }),
        ]),
      });

      // Starts race in controller
      expect(raceController.startRace).toHaveBeenCalledWith(room, {
        id: "p1",
        text: "Hello world",
        charCount: 11,
        wordCount: 2,
      });

      // Emits race-started to room
      expect(io.to).toHaveBeenCalledWith("ROOM1");
      expect(io._emitFn).toHaveBeenCalledWith("race-started", {
        passage: { id: "p1", text: "Hello world", charCount: 11, wordCount: 2 },
        countdownMs: 3000,
      });

      // Sets up progress validator
      expect(progressValidators.has("ROOM1")).toBe(true);
    });
  });

  describe("typing-progress", () => {
    it("silently returns when no roomCode on socket", async () => {
      socket.data.roomCode = null;

      await socket._trigger("typing-progress", { charIndex: 5 });

      expect(roomManager.getRoom).not.toHaveBeenCalled();
    });

    it("silently returns when room is not racing", async () => {
      const room = makeRoom({ status: "waiting" });
      roomManager.getRoom.mockReturnValue(room);

      await socket._trigger("typing-progress", { charIndex: 5 });

      expect(raceController.updateCharIndex).not.toHaveBeenCalled();
    });

    it("updates char index on valid progress", async () => {
      const room = makeRoom({ status: "racing" });
      roomManager.getRoom.mockReturnValue(room);

      // Set up a progress validator for this room
      const mockValidator = { validate: vi.fn().mockReturnValue({ valid: true }) };
      progressValidators.set("ROOM1", mockValidator as any);

      await socket._trigger("typing-progress", { charIndex: 5 });

      expect(mockValidator.validate).toHaveBeenCalledWith("user_1", 5);
      expect(raceController.updateCharIndex).toHaveBeenCalledWith("ROOM1", "user_1", 5);
      expect(roomManager.touchRoom).toHaveBeenCalledWith("ROOM1");
    });

    it("silently drops invalid progress", async () => {
      const room = makeRoom({ status: "racing" });
      roomManager.getRoom.mockReturnValue(room);

      const mockValidator = { validate: vi.fn().mockReturnValue({ valid: false, reason: "bad" }) };
      progressValidators.set("ROOM1", mockValidator as any);

      await socket._trigger("typing-progress", { charIndex: 999 });

      expect(raceController.updateCharIndex).not.toHaveBeenCalled();
    });

    it("silently returns when no validator exists", async () => {
      const room = makeRoom({ status: "racing" });
      roomManager.getRoom.mockReturnValue(room);
      // No validator set

      await socket._trigger("typing-progress", { charIndex: 5 });

      expect(raceController.updateCharIndex).not.toHaveBeenCalled();
    });
  });

  describe("player-finished", () => {
    it("silently returns when no roomCode", async () => {
      socket.data.roomCode = null;

      await socket._trigger("player-finished", {
        ghostData: [],
        correctKeystrokes: 10,
        totalKeystrokes: 12,
      });

      expect(raceController.playerFinished).not.toHaveBeenCalled();
    });

    it("silently returns when room not racing", async () => {
      const room = makeRoom({ status: "waiting" });
      roomManager.getRoom.mockReturnValue(room);

      await socket._trigger("player-finished", {
        ghostData: [],
        correctKeystrokes: 10,
        totalKeystrokes: 12,
      });

      expect(raceController.playerFinished).not.toHaveBeenCalled();
    });

    it("silently returns when raceStartedAt is null", async () => {
      const room = makeRoom({ status: "racing", raceStartedAt: null });
      roomManager.getRoom.mockReturnValue(room);

      await socket._trigger("player-finished", {
        ghostData: [],
        correctKeystrokes: 10,
        totalKeystrokes: 12,
      });

      expect(raceController.playerFinished).not.toHaveBeenCalled();
    });

    it("rejects negative keystroke counts", async () => {
      const room = makeRoom({ status: "racing", raceStartedAt: Date.now() });
      roomManager.getRoom.mockReturnValue(room);

      await socket._trigger("player-finished", {
        ghostData: [],
        correctKeystrokes: -1,
        totalKeystrokes: 10,
      });

      expect(raceController.playerFinished).not.toHaveBeenCalled();
    });

    it("rejects correctKeystrokes > totalKeystrokes", async () => {
      const room = makeRoom({ status: "racing", raceStartedAt: Date.now() });
      roomManager.getRoom.mockReturnValue(room);

      await socket._trigger("player-finished", {
        ghostData: [],
        correctKeystrokes: 20,
        totalKeystrokes: 10,
      });

      expect(raceController.playerFinished).not.toHaveBeenCalled();
    });

    it("persists results and checks if all finished", async () => {
      const room = makeRoom({ status: "racing", raceStartedAt: Date.now() });
      roomManager.getRoom.mockReturnValue(room);

      raceController.playerFinished.mockReturnValue({
        placement: 1,
        wpm: 60,
        accuracy: 95.5,
      });
      raceController.allPlayersFinished.mockReturnValue(false);

      const matchRecord = { id: "match_1" };
      mockPrisma.match.findUnique.mockResolvedValue(matchRecord as any);
      mockPrisma.matchPlayer.updateMany.mockResolvedValue({ count: 1 } as any);

      const ghostData = [{ charIndex: 0, ms: 0 }, { charIndex: 5, ms: 500 }];

      await socket._trigger("player-finished", {
        ghostData,
        correctKeystrokes: 100,
        totalKeystrokes: 105,
      });

      expect(raceController.playerFinished).toHaveBeenCalledWith("ROOM1", "user_1", {
        ghostData,
        correctKeystrokes: 100,
        totalKeystrokes: 105,
      });

      expect(mockPrisma.matchPlayer.updateMany).toHaveBeenCalledWith({
        where: { matchId: "match_1", userId: "user_1" },
        data: {
          wpm: 60,
          accuracy: 95.5,
          placement: 1,
          clientGhostData: ghostData as never,
          serverGhost: [] as never,
          flagged: false,
          status: "finished",
          finishedAt: expect.any(Date),
        },
      });
    });

    it("persists clientGhostData + serverGhost + flagged=false on MatchPlayer at finish", async () => {
      // arrange: a match in progress with two players, alice has typed; bob hasn't finished
      const room = makeRoom({ status: "racing", raceStartedAt: Date.now() });
      roomManager.getRoom.mockReturnValue(room);

      // simulate alice progress on the controller (real mock, just call updateCharIndex)
      raceController.updateCharIndex("ROOM1", "alice", 5);

      raceController.playerFinished.mockReturnValue({
        placement: 1,
        wpm: 60,
        accuracy: 100,
      });
      raceController.getFinishedPlayerData = vi.fn().mockReturnValue({
        wpm: 60,
        accuracy: 100,
        clientGhostData: [{ charIndex: 0, ms: 0 }, { charIndex: 5, ms: 100 }],
        serverGhost: [{ charIndex: 0, serverMs: 0 }, { charIndex: 5, serverMs: 100 }],
      });
      raceController.allPlayersFinished.mockReturnValue(false);

      const matchRecord = { id: "match_1" };
      mockPrisma.match.findUnique.mockResolvedValue(matchRecord as any);
      mockPrisma.matchPlayer.updateMany.mockResolvedValue({ count: 1 } as any);

      // act: client emits player-finished with ghostData
      await socket._trigger("player-finished", {
        ghostData: [{ charIndex: 0, ms: 0 }, { charIndex: 5, ms: 100 }],
        correctKeystrokes: 5,
        totalKeystrokes: 5,
      });

      // assert: matchPlayer updated with both ghost fields
      const updateCall = mockPrisma.matchPlayer.updateMany.mock.calls.at(-1)?.[0];
      expect(updateCall.data.clientGhostData).toEqual([{ charIndex: 0, ms: 0 }, { charIndex: 5, ms: 100 }]);
      expect(updateCall.data.serverGhost).toBeDefined();
      expect(Array.isArray(updateCall.data.serverGhost)).toBe(true);
      expect(updateCall.data.flagged).toBe(false);
    });

    it("calls finishRace when all players finished", async () => {
      const room = makeRoom({ status: "racing", raceStartedAt: Date.now() });
      roomManager.getRoom.mockReturnValue(room);

      raceController.playerFinished.mockReturnValue({ placement: 2, wpm: 45, accuracy: 90 });
      raceController.allPlayersFinished.mockReturnValue(true);
      raceController.getRankings.mockReturnValue([]);

      mockPrisma.match.findUnique.mockResolvedValue({ id: "match_1" } as any);
      mockPrisma.matchPlayer.updateMany.mockResolvedValue({ count: 1 } as any);
      mockPrisma.match.update.mockResolvedValue({} as any);

      await socket._trigger("player-finished", {
        ghostData: [],
        correctKeystrokes: 90,
        totalKeystrokes: 100,
      });

      // finishRace should update match status
      expect(mockPrisma.match.update).toHaveBeenCalledWith({
        where: { roomCode: "ROOM1" },
        data: { status: "completed" },
      });
    });
  });
});

describe("finishRace", () => {
  let io: ReturnType<typeof createMockIo>;
  let roomManager: ReturnType<typeof createMockRoomManager>;
  let raceController: ReturnType<typeof createMockRaceController>;

  function createMockIo() {
    const emitFn = vi.fn();
    return {
      to: vi.fn(() => ({ emit: emitFn })),
      _emitFn: emitFn,
    };
  }

  function createMockRoomManager() {
    return {
      getRoom: vi.fn(),
      touchRoom: vi.fn(),
      setRoomStatus: vi.fn(),
      removePlayer: vi.fn(),
    };
  }

  function createMockRaceController() {
    return {
      startRace: vi.fn(),
      updateCharIndex: vi.fn(),
      playerFinished: vi.fn(),
      allPlayersFinished: vi.fn(),
      getProgressSnapshot: vi.fn().mockReturnValue([]),
      getRankings: vi.fn().mockReturnValue([]),
      cleanupRace: vi.fn(),
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    progressValidators.clear();
    io = createMockIo();
    roomManager = createMockRoomManager();
    raceController = createMockRaceController();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears timers and emits race-results", async () => {
    const raceTimeout = setTimeout(() => {}, 99999);
    const broadcastInterval = setInterval(() => {}, 100);
    const room = makeRoom({
      status: "racing",
      raceTimeoutTimer: raceTimeout,
      progressBroadcastInterval: broadcastInterval,
    });

    const rankings = [
      { userId: "user_1", username: "alice", displayBird: "eagle", wpm: 60, accuracy: 95, placement: 1, status: "finished" },
    ];
    raceController.getRankings.mockReturnValue(rankings);
    mockPrisma.match.update.mockResolvedValue({} as any);
    mockPrisma.match.findUnique.mockResolvedValue({ id: "match_1" } as any);

    await finishRace(io as any, "ROOM1", room as any, roomManager as any, raceController as any);

    expect(room.raceTimeoutTimer).toBeNull();
    expect(room.progressBroadcastInterval).toBeNull();
    expect(room.status).toBe("completed");
    expect(roomManager.setRoomStatus).toHaveBeenCalledWith("ROOM1", "completed");

    expect(io._emitFn).toHaveBeenCalledWith("race-results", { rankings });
    expect(raceController.cleanupRace).toHaveBeenCalledWith("ROOM1");
    expect(progressValidators.has("ROOM1")).toBe(false);
  });

  it("emits race-timeout when isTimeout is true", async () => {
    const room = makeRoom({ status: "racing", raceTimeoutTimer: null, progressBroadcastInterval: null });
    const rankings = [{ userId: "user_1", status: "dnf" }];
    raceController.getRankings.mockReturnValue(rankings);
    mockPrisma.match.update.mockResolvedValue({} as any);
    mockPrisma.match.findUnique.mockResolvedValue({ id: "match_1" } as any);

    await finishRace(io as any, "ROOM1", room as any, roomManager as any, raceController as any, true);

    expect(io._emitFn).toHaveBeenCalledWith("race-timeout", { rankings });
  });

  it("marks DNF players as abandoned in DB", async () => {
    const room = makeRoom({ status: "racing", raceTimeoutTimer: null, progressBroadcastInterval: null });
    const rankings = [
      { userId: "user_1", status: "finished", placement: 1, wpm: 60, accuracy: 95 },
      { userId: "user_2", status: "dnf", placement: 2, wpm: null, accuracy: null },
    ];
    raceController.getRankings.mockReturnValue(rankings);
    mockPrisma.match.update.mockResolvedValue({} as any);
    mockPrisma.match.findUnique.mockResolvedValue({ id: "match_1" } as any);
    mockPrisma.matchPlayer.updateMany.mockResolvedValue({ count: 1 } as any);

    await finishRace(io as any, "ROOM1", room as any, roomManager as any, raceController as any);

    expect(mockPrisma.matchPlayer.updateMany).toHaveBeenCalledWith({
      where: { matchId: "match_1", userId: "user_2" },
      data: { status: "abandoned" },
    });
    // Should NOT update user_1 (who finished)
    expect(mockPrisma.matchPlayer.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user_1" }),
      })
    );
  });
});
