import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RoomManager } from "../../src/rooms/room-manager.js";
import { RaceController } from "../../src/race/race-controller.js";
import {
  markPlayerDisconnected,
  handleNewReconnect,
  defaultSessionStore,
  defaultSocketRegistry,
  registerSocket,
  unregisterSocket,
  resetTokenAttempts,
} from "../../src/handlers/connection-handler.js";
import { mintResumeToken } from "../../src/lib/resume-token.js";
import { prisma } from "../../src/lib/prisma.js";

const SECRET = "a".repeat(64);

interface FakeSocket {
  id: string;
  data: { userId?: string; roomCode?: string };
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  join: ReturnType<typeof vi.fn>;
}

function makeFakeSocket(id: string, userId: string, roomCode: string): FakeSocket {
  return {
    id,
    data: { userId, roomCode },
    emit: vi.fn(),
    disconnect: vi.fn(),
    join: vi.fn(),
  };
}

function makeFakeIo() {
  const roomEmit = vi.fn();
  const to = vi.fn(() => ({ emit: roomEmit }));
  return { to, roomEmit };
}

describe("reconnect end-to-end integration", () => {
  let roomManager: RoomManager;
  let raceController: RaceController;
  let matchRow: { id: string };
  let roomCode: string;
  let passageId: string;

  beforeEach(async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"],
    });
    resetTokenAttempts();
    defaultSessionStore.clear();
    defaultSocketRegistry.clear();

    roomManager = new RoomManager();
    raceController = new RaceController(() => {});

    const passage = await prisma.passage.findFirst();
    if (!passage) throw new Error("Seed the DB: at least one Passage is required");
    passageId = passage.id;

    const room = roomManager.createRoom("alice", "Alice", "robin", "sock-alice-old", "medium");
    roomCode = room.code;
    roomManager.joinRoom(roomCode, "bob", "Bob", "eagle", "sock-bob");

    matchRow = await prisma.match.create({
      data: {
        roomCode: roomCode + "-" + Date.now(),
        passageId,
        status: "racing",
        startedAt: new Date(),
        epochs: { alice: 1 },
      },
    });

    raceController.startRace(room, {
      id: passageId,
      text: "one two three four five six seven eight nine ten",
      charCount: 48,
      wordCount: 10,
    });

    // Seed bob's progress so the snapshot carries a non-zero value.
    raceController.updateCharIndex(roomCode, "bob", 5);

    defaultSessionStore.set("alice:" + roomCode, {
      epoch: 1,
      sessionId: "sid-initial",
      matchId: matchRow.id,
    });
  });

  afterEach(async () => {
    await prisma.match.deleteMany({ where: { id: matchRow.id } }).catch(() => {});
    defaultSessionStore.clear();
    defaultSocketRegistry.clear();
    raceController.destroy();
    roomManager.destroy();
    vi.useRealTimers();
  });

  it("reconnects within the 20s window, fences old socket, snapshots all players, atomically bumps epoch", async () => {
    const oldSocket = makeFakeSocket("sock-alice-old", "alice", roomCode);
    const newSocket = makeFakeSocket("sock-alice-new", "alice", roomCode);
    registerSocket(oldSocket as never);

    const io = makeFakeIo();

    markPlayerDisconnected(
      io as never,
      oldSocket as never,
      roomManager,
      raceController,
      roomCode,
      "alice"
    );

    // Advance 18s — still inside the 20s window.
    vi.advanceTimersByTime(18_000);

    const token = mintResumeToken(SECRET, {
      userId: "alice",
      roomCode,
      sessionEpoch: 1,
      sessionId: "sid-initial",
    });

    await handleNewReconnect(
      io as never,
      newSocket as never,
      roomManager,
      raceController,
      SECRET,
      token
    );

    // Old socket was fenced synchronously.
    expect(oldSocket.disconnect).toHaveBeenCalledWith(true);

    // resume-state emitted with correct payload.
    const resumeCall = newSocket.emit.mock.calls.find((c) => c[0] === "resume-state");
    expect(resumeCall).toBeDefined();
    const payload = resumeCall![1] as {
      token: string;
      charIndex: number;
      raceElapsedMs: number;
      comboCount: number;
      comboPaused: boolean;
      comboPausedAtCharIndex: number;
      players: Array<{ userId: string; charIndex: number; isConnected: boolean }>;
    };

    expect(typeof payload.token).toBe("string");
    expect(payload.token.length).toBeGreaterThan(0);
    expect(payload.comboCount).toBe(0);
    expect(payload.comboPaused).toBe(false);
    expect(payload.comboPausedAtCharIndex).toBe(0);
    expect(Array.isArray(payload.players)).toBe(true);

    const bob = payload.players.find((p) => p.userId === "bob");
    expect(bob).toBeDefined();
    expect(bob!.charIndex).toBe(5);
    expect(bob!.isConnected).toBe(true);

    const alice = payload.players.find((p) => p.userId === "alice");
    expect(alice).toBeDefined();

    // Epoch incremented atomically in Postgres.
    const updated = await prisma.match.findUnique({ where: { id: matchRow.id } });
    expect(updated).not.toBeNull();
    const epochs = updated!.epochs as Record<string, number>;
    expect(epochs.alice).toBe(2);

    // Session store reflects the new epoch + a fresh sessionId.
    const entry = defaultSessionStore.get("alice:" + roomCode);
    expect(entry).toBeDefined();
    expect(entry!.epoch).toBe(2);
    expect(entry!.sessionId).not.toBe("sid-initial");

    // New socket is now registered.
    expect(defaultSocketRegistry.get("sock-alice-new")).toBeDefined();

    // Old socket is no longer in the registry.
    expect(defaultSocketRegistry.get("sock-alice-old")).toBeUndefined();

    // player-reconnected broadcast went out.
    expect(io.to).toHaveBeenCalledWith(roomCode);
    const reconnectBroadcast = io.roomEmit.mock.calls.find((c) => c[0] === "player-reconnected");
    expect(reconnectBroadcast).toBeDefined();
    expect(reconnectBroadcast![1]).toEqual({ userId: "alice" });

    // cleanup to satisfy afterEach — prevent further timer impact
    unregisterSocket(newSocket.id);
  });

  it("rejects reconnect with a stale epoch token", async () => {
    const newSocket = makeFakeSocket("sock-alice-new2", "alice", roomCode);
    const io = makeFakeIo();

    // Token minted with epoch=0 (stale — session store has epoch=1)
    const staleToken = mintResumeToken(SECRET, {
      userId: "alice",
      roomCode,
      sessionEpoch: 0,
      sessionId: "sid-initial",
    });

    await handleNewReconnect(
      io as never,
      newSocket as never,
      roomManager,
      raceController,
      SECRET,
      staleToken
    );

    const errorCall = newSocket.emit.mock.calls.find((c) => c[0] === "reconnect-error");
    expect(errorCall).toBeDefined();
    expect(errorCall![1]).toEqual({ reason: "epoch-mismatch" });

    // Session store untouched.
    const entry = defaultSessionStore.get("alice:" + roomCode);
    expect(entry!.epoch).toBe(1);
  });
});
