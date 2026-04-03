import { handleDisconnect, handleReconnect } from "./connection-handler.js";

vi.mock("./race-handlers.js", () => ({
  finishRace: vi.fn(),
}));

import { finishRace } from "./race-handlers.js";
const mockFinishRace = vi.mocked(finishRace);

function createMockSocket(overrides: Record<string, unknown> = {}) {
  return {
    id: "sock-1",
    data: { userId: "clerk_1", username: "alice", displayBird: "robin", roomCode: "ROOM1" } as Record<string, unknown>,
    emit: vi.fn(),
    join: vi.fn(),
    ...overrides,
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
    removePlayer: vi.fn(),
    disconnectPlayer: vi.fn(),
    reconnectPlayer: vi.fn(),
    setRoomStatus: vi.fn(),
    touchRoom: vi.fn(),
  };
}

function createMockRaceController() {
  return {
    allPlayersFinished: vi.fn().mockReturnValue(false),
    getProgressSnapshot: vi.fn().mockReturnValue([]),
    getRankings: vi.fn().mockReturnValue([]),
    cleanupRace: vi.fn(),
    startRace: vi.fn(),
    updateCharIndex: vi.fn(),
    playerFinished: vi.fn(),
  };
}

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    code: "ROOM1",
    status: "waiting" as string,
    hostUserId: "user_1",
    difficulty: "medium" as const,
    passageId: null as string | null,
    passageText: null as string | null,
    passageCharCount: null as number | null,
    raceStartedAt: null as number | null,
    raceTimeoutTimer: null,
    progressBroadcastInterval: null,
    players: new Map([
      ["user_1", { userId: "user_1", username: "alice", displayBird: "eagle", socketId: "sock-1", isHost: true, isConnected: true, disconnectedAt: null }],
      ["user_2", { userId: "user_2", username: "bob", displayBird: "robin", socketId: "sock-2", isHost: false, isConnected: true, disconnectedAt: null }],
    ]),
    ...overrides,
  };
}

describe("handleDisconnect", () => {
  let io: ReturnType<typeof createMockIo>;
  let roomManager: ReturnType<typeof createMockRoomManager>;
  let raceController: ReturnType<typeof createMockRaceController>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    io = createMockIo();
    roomManager = createMockRoomManager();
    raceController = createMockRaceController();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing when socket has no roomCode", () => {
    const socket = createMockSocket({ data: { roomCode: null } });

    handleDisconnect(io as any, socket as any, roomManager as any, raceController as any);

    expect(roomManager.getRoom).not.toHaveBeenCalled();
  });

  it("does nothing when room not found", () => {
    const socket = createMockSocket();
    roomManager.getRoom.mockReturnValue(undefined);

    handleDisconnect(io as any, socket as any, roomManager as any, raceController as any);

    expect(roomManager.disconnectPlayer).not.toHaveBeenCalled();
    expect(roomManager.removePlayer).not.toHaveBeenCalled();
  });

  it("does nothing when socket id not found in room players", () => {
    const socket = createMockSocket({ id: "unknown-sock" });
    const room = makeRoom();
    roomManager.getRoom.mockReturnValue(room);

    handleDisconnect(io as any, socket as any, roomManager as any, raceController as any);

    expect(roomManager.disconnectPlayer).not.toHaveBeenCalled();
    expect(roomManager.removePlayer).not.toHaveBeenCalled();
  });

  describe("during waiting", () => {
    it("removes player and emits player-left", () => {
      const socket = createMockSocket();
      const room = makeRoom({ status: "waiting" });
      roomManager.getRoom.mockReturnValue(room);
      roomManager.removePlayer.mockReturnValue({ removed: true, roomDeleted: false, newHostUserId: null });

      handleDisconnect(io as any, socket as any, roomManager as any, raceController as any);

      expect(roomManager.removePlayer).toHaveBeenCalledWith("ROOM1", "user_1");
      expect(io._emitFn).toHaveBeenCalledWith("player-left", { userId: "user_1" });
    });

    it("does not emit when room is deleted (last player)", () => {
      const socket = createMockSocket();
      const room = makeRoom({ status: "waiting" });
      roomManager.getRoom.mockReturnValue(room);
      roomManager.removePlayer.mockReturnValue({ removed: true, roomDeleted: true, newHostUserId: null });

      handleDisconnect(io as any, socket as any, roomManager as any, raceController as any);

      expect(io._emitFn).not.toHaveBeenCalled();
    });

    it("emits room-state when host transfers", () => {
      const socket = createMockSocket();
      const room = makeRoom({ status: "waiting" });
      roomManager.getRoom.mockReturnValue(room);
      roomManager.removePlayer.mockReturnValue({ removed: true, roomDeleted: false, newHostUserId: "user_2" });

      // After removal, getRoom returns updated room for emitRoomState
      const updatedRoom = makeRoom({ status: "waiting", hostUserId: "user_2" });
      updatedRoom.players.delete("user_1");
      updatedRoom.players.get("user_2")!.isHost = true;
      // First call is in handleDisconnect for finding user, second is in emitRoomState
      roomManager.getRoom.mockReturnValueOnce(room).mockReturnValueOnce(updatedRoom);

      handleDisconnect(io as any, socket as any, roomManager as any, raceController as any);

      // Should emit player-left
      expect(io._emitFn).toHaveBeenCalledWith("player-left", { userId: "user_1" });
      // Should emit room-state with new host info
      expect(io._emitFn).toHaveBeenCalledWith("room-state", expect.objectContaining({
        code: "ROOM1",
        hostUserId: "user_2",
      }));
    });
  });

  describe("during racing", () => {
    it("marks player disconnected and emits player-left", () => {
      const socket = createMockSocket();
      const room = makeRoom({ status: "racing" });
      roomManager.getRoom.mockReturnValue(room);

      handleDisconnect(io as any, socket as any, roomManager as any, raceController as any);

      expect(roomManager.disconnectPlayer).toHaveBeenCalledWith("ROOM1", "user_1");
      expect(io._emitFn).toHaveBeenCalledWith("player-left", { userId: "user_1" });
    });

    it("removes player after grace period and finishes race if all done", () => {
      const socket = createMockSocket();
      const room = makeRoom({ status: "racing" });
      roomManager.getRoom.mockReturnValue(room);
      raceController.allPlayersFinished.mockReturnValue(true);

      handleDisconnect(io as any, socket as any, roomManager as any, raceController as any);

      // Player not removed yet
      expect(roomManager.removePlayer).not.toHaveBeenCalled();

      // Advance timer by 30 seconds (RECONNECT_GRACE_MS)
      vi.advanceTimersByTime(30_000);

      expect(roomManager.removePlayer).toHaveBeenCalledWith("ROOM1", "user_1");
      expect(mockFinishRace).toHaveBeenCalled();
    });

    it("does not call finishRace if not all players finished after grace", () => {
      const socket = createMockSocket();
      const room = makeRoom({ status: "racing" });
      roomManager.getRoom.mockReturnValue(room);
      raceController.allPlayersFinished.mockReturnValue(false);

      handleDisconnect(io as any, socket as any, roomManager as any, raceController as any);

      vi.advanceTimersByTime(30_000);

      expect(roomManager.removePlayer).toHaveBeenCalledWith("ROOM1", "user_1");
      expect(mockFinishRace).not.toHaveBeenCalled();
    });
  });
});

describe("handleReconnect", () => {
  let io: ReturnType<typeof createMockIo>;
  let roomManager: ReturnType<typeof createMockRoomManager>;
  let raceController: ReturnType<typeof createMockRaceController>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    io = createMockIo();
    roomManager = createMockRoomManager();
    raceController = createMockRaceController();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when room not found", () => {
    const socket = createMockSocket();
    roomManager.getRoom.mockReturnValue(undefined);

    const result = handleReconnect(io as any, socket as any, roomManager as any, raceController as any, "ROOM1", "user_1");

    expect(result).toBe(false);
  });

  it("returns false when reconnectPlayer fails", () => {
    const socket = createMockSocket();
    const room = makeRoom();
    roomManager.getRoom.mockReturnValue(room);
    roomManager.reconnectPlayer.mockReturnValue(false);

    const result = handleReconnect(io as any, socket as any, roomManager as any, raceController as any, "ROOM1", "user_1");

    expect(result).toBe(false);
  });

  it("reconnects player, cancels grace timer, joins room, and emits events", () => {
    const socket = createMockSocket({ id: "sock-new" });
    const room = makeRoom({ status: "waiting" });
    roomManager.getRoom.mockReturnValue(room);
    roomManager.reconnectPlayer.mockReturnValue(true);

    const result = handleReconnect(io as any, socket as any, roomManager as any, raceController as any, "ROOM1", "user_1");

    expect(result).toBe(true);
    expect(roomManager.reconnectPlayer).toHaveBeenCalledWith("ROOM1", "user_1", "sock-new");
    expect(socket.data.roomCode).toBe("ROOM1");
    expect(socket.join).toHaveBeenCalledWith("ROOM1");
    expect(io._emitFn).toHaveBeenCalledWith("player-reconnected", { userId: "user_1" });

    // Should emit room-state to reconnecting player
    expect(socket.emit).toHaveBeenCalledWith("room-state", expect.objectContaining({
      code: "ROOM1",
      status: "waiting",
      hostUserId: "user_1",
      yourUserId: "user_1",
    }));
  });

  it("cancels disconnect grace timer on reconnect", () => {
    // First, create a disconnect to set up a timer
    const disconnectSocket = createMockSocket();
    const room = makeRoom({ status: "racing" });
    roomManager.getRoom.mockReturnValue(room);

    handleDisconnect(io as any, disconnectSocket as any, roomManager as any, raceController as any);

    // Now reconnect before grace period expires
    const reconnectSocket = createMockSocket({ id: "sock-new" });
    roomManager.reconnectPlayer.mockReturnValue(true);

    const result = handleReconnect(io as any, reconnectSocket as any, roomManager as any, raceController as any, "ROOM1", "user_1");
    expect(result).toBe(true);

    // Advance past grace period - removePlayer should NOT be called
    // because the timer was cancelled
    vi.advanceTimersByTime(30_000);

    // removePlayer should not have been called (timer was cancelled)
    expect(roomManager.removePlayer).not.toHaveBeenCalled();
  });

  it("includes passage info in room-state when racing", () => {
    const socket = createMockSocket({ id: "sock-new" });
    const room = makeRoom({
      status: "racing",
      passageId: "p1",
      passageText: "Hello world test",
      passageCharCount: 16,
      raceStartedAt: 1000,
    });
    roomManager.getRoom.mockReturnValue(room);
    roomManager.reconnectPlayer.mockReturnValue(true);
    raceController.getProgressSnapshot.mockReturnValue([
      { userId: "user_1", progress: 0.5 },
      { userId: "user_2", progress: 0.3 },
    ]);

    handleReconnect(io as any, socket as any, roomManager as any, raceController as any, "ROOM1", "user_1");

    expect(socket.emit).toHaveBeenCalledWith("room-state", expect.objectContaining({
      code: "ROOM1",
      status: "racing",
      passage: {
        id: "p1",
        text: "Hello world test",
        charCount: 16,
        wordCount: 3,
      },
      raceStartedAt: 1000,
      yourCharIndex: 8, // Math.floor(0.5 * 16)
    }));
  });

  it("omits yourCharIndex when player has no progress snapshot", () => {
    const socket = createMockSocket({ id: "sock-new" });
    const room = makeRoom({
      status: "racing",
      passageId: "p1",
      passageText: "Hello world",
      passageCharCount: 11,
      raceStartedAt: 1000,
    });
    roomManager.getRoom.mockReturnValue(room);
    roomManager.reconnectPlayer.mockReturnValue(true);
    raceController.getProgressSnapshot.mockReturnValue([
      { userId: "user_2", progress: 0.3 },
    ]);

    handleReconnect(io as any, socket as any, roomManager as any, raceController as any, "ROOM1", "user_1");

    const emittedState = socket.emit.mock.calls.find(
      (call: any[]) => call[0] === "room-state"
    )?.[1];
    expect(emittedState).toBeDefined();
    expect(emittedState.yourCharIndex).toBeUndefined();
  });
});
