import { handleDisconnect, handleReconnect, handleNewReconnect, markPlayerDisconnected } from "./connection-handler.js";

vi.mock("./race-handlers.js", () => ({
  finishRace: vi.fn(),
}));

vi.mock("../lib/resume-token.js", () => ({
  mintResumeToken: vi.fn(),
  verifyResumeToken: vi.fn(),
  RESUME_WINDOW_MS: 20_000,
}));

import { finishRace } from "./race-handlers.js";
import { mintResumeToken, verifyResumeToken } from "../lib/resume-token.js";
const mockFinishRace = vi.mocked(finishRace);
const mockMintResumeToken = vi.mocked(mintResumeToken);
const mockVerifyResumeToken = vi.mocked(verifyResumeToken);

function createMockSocket(overrides: Record<string, unknown> = {}) {
  return {
    id: "sock-1",
    data: { userId: "clerk_1", username: "alice", displayBird: "robin", roomCode: "ROOM1" } as Record<string, unknown>,
    emit: vi.fn(),
    join: vi.fn(),
    disconnect: vi.fn(),
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
    incrementEpoch: vi.fn().mockResolvedValue(1),
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
    it("marks player disconnected and emits player-disconnected (P2-7: 20s window)", () => {
      const socket = createMockSocket();
      const room = makeRoom({ status: "racing" });
      roomManager.getRoom.mockReturnValue(room);
      // Make disconnectPlayer actually mutate the room so timer guard works correctly
      roomManager.disconnectPlayer.mockImplementation((code: string, uid: string) => {
        const p = room.players.get(uid);
        if (p) { p.isConnected = false; }
      });

      handleDisconnect(io as any, socket as any, roomManager as any, raceController as any);

      expect(roomManager.disconnectPlayer).toHaveBeenCalledWith("ROOM1", "user_1");
      // P2-7: emits player-disconnected (not player-left) during race
      expect(io._emitFn).toHaveBeenCalledWith("player-disconnected", { userId: "user_1" });
    });

    it("removes player after 20s reconnect window and broadcasts player-dropped; finishes race if all done", () => {
      const socket = createMockSocket();
      const room = makeRoom({ status: "racing" });
      roomManager.getRoom.mockReturnValue(room);
      raceController.allPlayersFinished.mockReturnValue(true);
      // Simulate disconnectPlayer mutating the player
      roomManager.disconnectPlayer.mockImplementation((code: string, uid: string) => {
        const p = room.players.get(uid);
        if (p) { p.isConnected = false; }
      });

      handleDisconnect(io as any, socket as any, roomManager as any, raceController as any);

      // Player not removed yet
      expect(roomManager.removePlayer).not.toHaveBeenCalled();

      // Advance timer by 20 seconds (RECONNECT_WINDOW_MS)
      vi.advanceTimersByTime(20_000);

      expect(roomManager.removePlayer).toHaveBeenCalledWith("ROOM1", "user_1");
      expect(io._emitFn).toHaveBeenCalledWith("player-dropped", { userId: "user_1" });
      expect(mockFinishRace).toHaveBeenCalled();
    });

    it("does not call finishRace if not all players finished after 20s grace", () => {
      const socket = createMockSocket();
      const room = makeRoom({ status: "racing" });
      roomManager.getRoom.mockReturnValue(room);
      raceController.allPlayersFinished.mockReturnValue(false);
      roomManager.disconnectPlayer.mockImplementation((code: string, uid: string) => {
        const p = room.players.get(uid);
        if (p) { p.isConnected = false; }
      });

      handleDisconnect(io as any, socket as any, roomManager as any, raceController as any);

      vi.advanceTimersByTime(20_000);

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
    // Simulate disconnectPlayer mutating the player so the DNF timer guard works
    roomManager.disconnectPlayer.mockImplementation((code: string, uid: string) => {
      const p = room.players.get(uid);
      if (p) { p.isConnected = false; }
    });

    handleDisconnect(io as any, disconnectSocket as any, roomManager as any, raceController as any);

    // Now reconnect before grace period expires
    const reconnectSocket = createMockSocket({ id: "sock-new" });
    roomManager.reconnectPlayer.mockReturnValue(true);

    const result = handleReconnect(io as any, reconnectSocket as any, roomManager as any, raceController as any, "ROOM1", "user_1");
    expect(result).toBe(true);

    // Advance past the 20s reconnect window — removePlayer should NOT be called
    // because the timer was cancelled on reconnect
    vi.advanceTimersByTime(20_000);

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

// ─── New P2-7 tests: reconnection protocol ───────────────────────────────────

describe("markPlayerDisconnected (P2-7 reconnection protocol)", () => {
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

  it("on disconnect marks player isConnected=false and preserves seat for 20s", async () => {
    const socket = createMockSocket({ id: "sock-1" });
    const room = makeRoom({
      status: "racing",
      players: new Map([
        ["user_1", { userId: "user_1", username: "alice", displayBird: "eagle", socketId: "sock-1", isHost: true, isConnected: true, disconnectedAt: null }],
        ["user_2", { userId: "user_2", username: "bob", displayBird: "robin", socketId: "sock-2", isHost: false, isConnected: true, disconnectedAt: null }],
      ]),
    });
    roomManager.getRoom.mockReturnValue(room);
    // disconnectPlayer must mutate the room so the 20s timer guard
    // (checks player.isConnected === false) functions correctly.
    roomManager.disconnectPlayer.mockImplementation((code: string, uid: string) => {
      const p = room.players.get(uid);
      if (p) { p.isConnected = false; }
    });

    markPlayerDisconnected(
      io as any,
      socket as any,
      roomManager as any,
      raceController as any,
      "ROOM1",
      "user_1"
    );

    // player-disconnected broadcast expected (new event, not player-left)
    expect(io._emitFn).toHaveBeenCalledWith("player-disconnected", { userId: "user_1" });
    expect(roomManager.disconnectPlayer).toHaveBeenCalledWith("ROOM1", "user_1");

    // Advance 19 seconds — player seat still preserved (no removePlayer)
    vi.advanceTimersByTime(19_000);
    expect(roomManager.removePlayer).not.toHaveBeenCalled();

    // Advance another 1.5s (total 20.5s) — DNF should fire
    raceController.allPlayersFinished.mockReturnValue(false);
    vi.advanceTimersByTime(1_500);

    expect(io._emitFn).toHaveBeenCalledWith("player-dropped", { userId: "user_1" });
  });
});

describe("handleNewReconnect (P2-7 reconnection protocol)", () => {
  let io: ReturnType<typeof createMockIo>;
  let roomManager: ReturnType<typeof createMockRoomManager>;
  let raceController: ReturnType<typeof createMockRaceController>;
  const SECRET = "a".repeat(64);

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    io = createMockIo();
    roomManager = createMockRoomManager();
    raceController = createMockRaceController();
    // Default: mint returns a predictable new token
    mockMintResumeToken.mockReturnValue("new-token-xyz");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("on reconnect with valid resumeToken fences the old socket synchronously", async () => {
    const oldSocket = createMockSocket({ id: "sock-old" });
    const newSocket = createMockSocket({ id: "sock-new", data: { userId: "user_1", roomCode: "ROOM1" } });

    const room = makeRoom({
      status: "racing",
      players: new Map([
        ["user_1", { userId: "user_1", username: "alice", displayBird: "eagle", socketId: "sock-old", isHost: true, isConnected: false, disconnectedAt: Date.now() }],
        ["user_2", { userId: "user_2", username: "bob", displayBird: "robin", socketId: "sock-2", isHost: false, isConnected: true, disconnectedAt: null }],
      ]),
    });
    roomManager.getRoom.mockReturnValue(room);
    roomManager.reconnectPlayer.mockReturnValue(true);
    roomManager.incrementEpoch.mockResolvedValue(2);

    // Stored session epoch = 1, token contains epoch = 1 — valid match
    mockVerifyResumeToken.mockReturnValue({
      valid: true,
      payload: { userId: "user_1", roomCode: "ROOM1", sessionEpoch: 1, sessionId: "sid-1", issuedAt: Date.now() },
    });

    raceController.getProgressSnapshot.mockReturnValue([
      { userId: "user_1", progress: 0.3 },
      { userId: "user_2", progress: 0.5 },
    ]);

    // Socket registry: maps socketId -> socket
    const socketRegistry = new Map<string, any>();
    socketRegistry.set("sock-old", oldSocket);
    socketRegistry.set("sock-new", newSocket);

    // Stored session data: (userId, roomCode) -> { epoch, sessionId }
    const sessionStore = new Map<string, { epoch: number; sessionId: string; matchId: string }>();
    sessionStore.set("user_1:ROOM1", { epoch: 1, sessionId: "sid-1", matchId: "match-1" });

    await handleNewReconnect(
      io as any,
      newSocket as any,
      roomManager as any,
      raceController as any,
      SECRET,
      "new-token-xyz", // the client's submitted token
      socketRegistry,
      sessionStore
    );

    // Old socket must be fenced synchronously with disconnect(true)
    expect(oldSocket.disconnect).toHaveBeenCalledWith(true);

    // Seat should be rebound to new socket
    expect(roomManager.reconnectPlayer).toHaveBeenCalledWith("ROOM1", "user_1", "sock-new");

    // resume-state emitted to new socket
    const resumeStateCall = (newSocket.emit as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: any[]) => c[0] === "resume-state"
    );
    expect(resumeStateCall).toBeDefined();
    expect(resumeStateCall![1]).toMatchObject({ token: "new-token-xyz" });
  });

  it("rejects reconnect with wrong sessionEpoch", async () => {
    const newSocket = createMockSocket({ id: "sock-new", data: { userId: "user_1", roomCode: "ROOM1" } });

    const room = makeRoom({ status: "racing" });
    roomManager.getRoom.mockReturnValue(room);

    // Token claims epoch=1 but stored epoch is 2 (already bumped)
    mockVerifyResumeToken.mockReturnValue({
      valid: true,
      payload: { userId: "user_1", roomCode: "ROOM1", sessionEpoch: 1, sessionId: "sid-stale", issuedAt: Date.now() },
    });

    const socketRegistry = new Map<string, any>();
    const sessionStore = new Map<string, { epoch: number; sessionId: string; matchId: string }>();
    sessionStore.set("user_1:ROOM1", { epoch: 2, sessionId: "sid-current", matchId: "match-1" });

    await handleNewReconnect(
      io as any,
      newSocket as any,
      roomManager as any,
      raceController as any,
      SECRET,
      "stale-token",
      socketRegistry,
      sessionStore
    );

    // reconnect-error must be emitted
    expect(newSocket.emit).toHaveBeenCalledWith("reconnect-error", expect.objectContaining({ reason: expect.any(String) }));
    // No seat rebinding
    expect(roomManager.reconnectPlayer).not.toHaveBeenCalled();
  });

  it("resume-state includes every connected player's current charIndex + isConnected", async () => {
    const oldSocket = createMockSocket({ id: "sock-old" });
    const newSocket = createMockSocket({ id: "sock-new", data: { userId: "user_1", roomCode: "ROOM1" } });

    const room = makeRoom({
      status: "racing",
      passageId: "p1",
      passageText: "Hello world test",
      passageCharCount: 16,
      raceStartedAt: Date.now() - 5000,
      players: new Map([
        ["user_1", { userId: "user_1", username: "alice", displayBird: "eagle", socketId: "sock-old", isHost: true, isConnected: false, disconnectedAt: null }],
        ["user_2", { userId: "user_2", username: "bob", displayBird: "robin", socketId: "sock-2", isHost: false, isConnected: true, disconnectedAt: null }],
      ]),
    });
    roomManager.getRoom.mockReturnValue(room);
    roomManager.reconnectPlayer.mockReturnValue(true);
    roomManager.incrementEpoch.mockResolvedValue(2);

    mockVerifyResumeToken.mockReturnValue({
      valid: true,
      payload: { userId: "user_1", roomCode: "ROOM1", sessionEpoch: 1, sessionId: "sid-1", issuedAt: Date.now() },
    });

    // Bob has charIndex=5 (progress 5/16 ≈ 0.3125)
    raceController.getProgressSnapshot.mockReturnValue([
      { userId: "user_1", progress: 0.2 },   // alice at charIndex≈3
      { userId: "user_2", progress: 5 / 16 }, // bob at charIndex=5
    ]);

    const socketRegistry = new Map<string, any>();
    socketRegistry.set("sock-old", oldSocket);
    const sessionStore = new Map<string, { epoch: number; sessionId: string; matchId: string }>();
    sessionStore.set("user_1:ROOM1", { epoch: 1, sessionId: "sid-1", matchId: "match-1" });

    await handleNewReconnect(
      io as any,
      newSocket as any,
      roomManager as any,
      raceController as any,
      SECRET,
      "valid-token",
      socketRegistry,
      sessionStore
    );

    const resumeStateCall = (newSocket.emit as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: any[]) => c[0] === "resume-state"
    );
    expect(resumeStateCall).toBeDefined();

    const payload = resumeStateCall![1];
    expect(payload.players).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: "user_2", charIndex: 5, isConnected: true }),
    ]));
    // alice's own entry should also be present
    expect(payload.players.find((p: any) => p.userId === "user_1")).toBeDefined();
  });
});
