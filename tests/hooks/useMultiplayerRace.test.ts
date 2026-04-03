import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMultiplayerRace } from "@/hooks/useMultiplayerRace";

// Build a mock socket that captures event handlers
function createMockSocket() {
  const handlers = new Map<string, Function>();
  return {
    connected: true,
    on: vi.fn((event: string, handler: Function) => {
      handlers.set(event, handler);
    }),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    io: { on: vi.fn(), off: vi.fn() },
    _trigger(event: string, ...args: any[]) {
      const handler = handlers.get(event);
      handler?.(...args);
    },
  };
}

describe("useMultiplayerRace", () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSocket = createMockSocket();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Initial state ---

  it("has correct default initial state", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    expect(result.current.roomCode).toBeNull();
    expect(result.current.lobbyPhase).toBe("waiting");
    expect(result.current.players).toEqual([]);
    expect(result.current.hostUserId).toBeNull();
    expect(result.current.isHost).toBe(false);
    expect(result.current.difficulty).toBe("medium");
    expect(result.current.passage).toBeNull();
    expect(result.current.countdownValue).toBe(3);
    expect(result.current.playerProgresses).toEqual({});
    expect(result.current.rankings).toBeNull();
    expect(result.current.raceStartedAt).toBeNull();
    expect(result.current.reconnectCharIndex).toBeNull();
    expect(result.current.myUserId).toBeNull();
    expect(result.current.connectionError).toBeNull();
  });

  // --- Emit actions ---

  it("createRoom emits create-room event", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    act(() => {
      result.current.createRoom("short");
    });

    expect(mockSocket.emit).toHaveBeenCalledWith("create-room", {
      difficulty: "short",
    });
  });

  it("joinRoom emits join-room event", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    act(() => {
      result.current.joinRoom("ABCD");
    });

    expect(mockSocket.emit).toHaveBeenCalledWith("join-room", {
      roomCode: "ABCD",
    });
  });

  it("startRace emits start-race event when roomCode is set", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    // First set roomCode via room-created event
    act(() => {
      mockSocket._trigger("room-created", { roomCode: "WXYZ" });
    });

    act(() => {
      result.current.startRace();
    });

    expect(mockSocket.emit).toHaveBeenCalledWith("start-race", {
      roomCode: "WXYZ",
    });
  });

  it("startRace does not emit when roomCode is null", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    act(() => {
      result.current.startRace();
    });

    expect(mockSocket.emit).not.toHaveBeenCalledWith(
      "start-race",
      expect.anything()
    );
  });

  it("sendProgress emits typing-progress event", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    act(() => {
      result.current.sendProgress(42);
    });

    expect(mockSocket.emit).toHaveBeenCalledWith("typing-progress", {
      charIndex: 42,
    });
  });

  it("sendFinished emits player-finished event", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));
    const ghostData = [
      { charIndex: 0, ms: 0 },
      { charIndex: 10, ms: 500 },
    ];

    act(() => {
      result.current.sendFinished(ghostData, 95, 100);
    });

    expect(mockSocket.emit).toHaveBeenCalledWith("player-finished", {
      ghostData,
      correctKeystrokes: 95,
      totalKeystrokes: 100,
    });
  });

  // --- Incoming socket events ---

  it("room-created event updates roomCode", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    act(() => {
      mockSocket._trigger("room-created", { roomCode: "ABCD" });
    });

    expect(result.current.roomCode).toBe("ABCD");
    expect(result.current.lobbyPhase).toBe("waiting");
  });

  it("room-state event updates all state fields", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    const roomState = {
      code: "ROOM1",
      status: "waiting" as const,
      hostUserId: "user-host",
      yourUserId: "user-me",
      difficulty: "long" as const,
      players: [
        {
          userId: "user-host",
          username: "Host",
          displayBird: "eagle",
          isHost: true,
          isConnected: true,
        },
        {
          userId: "user-me",
          username: "Me",
          displayBird: "robin",
          isHost: false,
          isConnected: true,
        },
      ],
      passage: { id: "p1", text: "hello world", charCount: 11, wordCount: 2 },
      raceStartedAt: 1000,
      yourCharIndex: 5,
    };

    act(() => {
      mockSocket._trigger("room-state", roomState);
    });

    expect(result.current.roomCode).toBe("ROOM1");
    expect(result.current.players).toEqual(roomState.players);
    expect(result.current.hostUserId).toBe("user-host");
    expect(result.current.myUserId).toBe("user-me");
    expect(result.current.difficulty).toBe("long");
    expect(result.current.passage).toEqual(roomState.passage);
    expect(result.current.raceStartedAt).toBe(1000);
    expect(result.current.lobbyPhase).toBe("racing");
    expect(result.current.reconnectCharIndex).toBe(5);
  });

  it("player-joined adds player to list", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    act(() => {
      mockSocket._trigger("player-joined", {
        userId: "u1",
        username: "Alice",
        displayBird: "sparrow",
      });
    });

    expect(result.current.players).toHaveLength(1);
    expect(result.current.players[0]).toEqual({
      userId: "u1",
      username: "Alice",
      displayBird: "sparrow",
      isHost: false,
      isConnected: true,
    });
  });

  it("player-joined does not add duplicate player", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    act(() => {
      mockSocket._trigger("player-joined", {
        userId: "u1",
        username: "Alice",
        displayBird: "sparrow",
      });
    });

    act(() => {
      mockSocket._trigger("player-joined", {
        userId: "u1",
        username: "Alice",
        displayBird: "sparrow",
      });
    });

    expect(result.current.players).toHaveLength(1);
  });

  it("player-left removes player from list", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    act(() => {
      mockSocket._trigger("player-joined", {
        userId: "u1",
        username: "Alice",
        displayBird: "sparrow",
      });
      mockSocket._trigger("player-joined", {
        userId: "u2",
        username: "Bob",
        displayBird: "eagle",
      });
    });

    act(() => {
      mockSocket._trigger("player-left", { userId: "u1" });
    });

    expect(result.current.players).toHaveLength(1);
    expect(result.current.players[0].userId).toBe("u2");
  });

  it("race-started triggers countdown sequence", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    act(() => {
      mockSocket._trigger("race-started", {
        passage: {
          id: "p1",
          text: "test passage",
          charCount: 12,
          wordCount: 2,
        },
        countdownMs: 3000,
      });
    });

    expect(result.current.lobbyPhase).toBe("countdown");
    expect(result.current.countdownValue).toBe(3);
    expect(result.current.passage).toEqual({
      id: "p1",
      text: "test passage",
      charCount: 12,
      wordCount: 2,
    });

    // Advance 1 second -> countdown = 2
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.countdownValue).toBe(2);

    // Advance 1 second -> countdown = 1
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.countdownValue).toBe(1);

    // Advance 1 second -> countdown = "GO"
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.countdownValue).toBe("GO");

    // Advance 1 second -> phase transitions to "racing"
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.lobbyPhase).toBe("racing");
    expect(result.current.raceStartedAt).toBeTypeOf("number");
  });

  it("player-progress updates progress map", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    act(() => {
      mockSocket._trigger("player-progress", {
        players: [
          { userId: "u1", progress: 0.5 },
          { userId: "u2", progress: 0.8 },
        ],
      });
    });

    expect(result.current.playerProgresses).toEqual({
      u1: 0.5,
      u2: 0.8,
    });
  });

  it("race-results sets rankings and phase to results", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    const rankings = [
      {
        userId: "u1",
        username: "Alice",
        displayBird: "sparrow",
        wpm: 80,
        accuracy: 98,
        placement: 1,
        status: "finished" as const,
      },
      {
        userId: "u2",
        username: "Bob",
        displayBird: "eagle",
        wpm: null,
        accuracy: null,
        placement: 2,
        status: "dnf" as const,
      },
    ];

    act(() => {
      mockSocket._trigger("race-results", { rankings });
    });

    expect(result.current.rankings).toEqual(rankings);
    expect(result.current.lobbyPhase).toBe("results");
  });

  it("race-timeout also sets rankings and phase to results", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    const rankings = [
      {
        userId: "u1",
        username: "Alice",
        displayBird: "sparrow",
        wpm: 60,
        accuracy: 95,
        placement: 1,
        status: "finished" as const,
      },
    ];

    act(() => {
      mockSocket._trigger("race-timeout", { rankings });
    });

    expect(result.current.rankings).toEqual(rankings);
    expect(result.current.lobbyPhase).toBe("results");
  });

  it("room-error sets connectionError", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    act(() => {
      mockSocket._trigger("room-error", { message: "Room is full" });
    });

    expect(result.current.connectionError).toBe("Room is full");
  });

  // --- Computed state ---

  it("isHost is true when myUserId matches hostUserId", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    act(() => {
      mockSocket._trigger("room-state", {
        code: "ROOM1",
        status: "waiting",
        hostUserId: "user-1",
        yourUserId: "user-1",
        difficulty: "medium",
        players: [],
      });
    });

    expect(result.current.isHost).toBe(true);
  });

  it("isHost is false when myUserId differs from hostUserId", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    act(() => {
      mockSocket._trigger("room-state", {
        code: "ROOM1",
        status: "waiting",
        hostUserId: "user-1",
        yourUserId: "user-2",
        difficulty: "medium",
        players: [],
      });
    });

    expect(result.current.isHost).toBe(false);
  });

  it("isHost is false when myUserId is null", () => {
    const { result } = renderHook(() => useMultiplayerRace(mockSocket as any));

    expect(result.current.isHost).toBe(false);
  });

  // --- Null socket guard ---

  it("actions are no-ops when socket is null", () => {
    const { result } = renderHook(() => useMultiplayerRace(null));

    // These should not throw
    act(() => {
      result.current.createRoom("medium");
      result.current.joinRoom("CODE");
      result.current.startRace();
      result.current.sendProgress(10);
      result.current.sendFinished([], 0, 0);
    });

    // No socket, no emits -- just verify no crash
    expect(result.current.roomCode).toBeNull();
  });

  // --- Cleanup ---

  it("unregisters event handlers on unmount", () => {
    const { unmount } = renderHook(() =>
      useMultiplayerRace(mockSocket as any)
    );

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith(
      "room-created",
      expect.any(Function)
    );
    expect(mockSocket.off).toHaveBeenCalledWith(
      "room-state",
      expect.any(Function)
    );
    expect(mockSocket.off).toHaveBeenCalledWith(
      "player-joined",
      expect.any(Function)
    );
    expect(mockSocket.off).toHaveBeenCalledWith(
      "player-left",
      expect.any(Function)
    );
    expect(mockSocket.off).toHaveBeenCalledWith(
      "race-started",
      expect.any(Function)
    );
    expect(mockSocket.off).toHaveBeenCalledWith(
      "player-progress",
      expect.any(Function)
    );
    expect(mockSocket.off).toHaveBeenCalledWith(
      "race-results",
      expect.any(Function)
    );
    expect(mockSocket.off).toHaveBeenCalledWith(
      "race-timeout",
      expect.any(Function)
    );
    expect(mockSocket.off).toHaveBeenCalledWith(
      "room-error",
      expect.any(Function)
    );
  });
});
