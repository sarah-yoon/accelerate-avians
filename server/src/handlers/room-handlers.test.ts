import { registerRoomHandlers } from "./room-handlers.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../lib/prisma.js";
const mockPrisma = vi.mocked(prisma, true);

function createMockSocket(overrides: Record<string, unknown> = {}) {
  const handlers = new Map<string, Function>();
  return {
    id: "sock-test",
    data: { userId: "clerk_1", username: "alice", displayBird: "robin", roomCode: null } as Record<string, unknown>,
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
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    getRoom: vi.fn(),
    removePlayer: vi.fn(),
    disconnectPlayer: vi.fn(),
    reconnectPlayer: vi.fn(),
    touchRoom: vi.fn(),
    setRoomStatus: vi.fn(),
  };
}

describe("registerRoomHandlers", () => {
  let socket: ReturnType<typeof createMockSocket>;
  let io: ReturnType<typeof createMockIo>;
  let roomManager: ReturnType<typeof createMockRoomManager>;

  beforeEach(() => {
    vi.resetAllMocks();
    socket = createMockSocket();
    io = createMockIo();
    roomManager = createMockRoomManager();
    registerRoomHandlers(io as any, socket as any, roomManager as any);
  });

  describe("create-room", () => {
    it("registers the handler", () => {
      expect(socket.on).toHaveBeenCalledWith("create-room", expect.any(Function));
    });

    it("emits room-error when user not found in DB", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await socket._trigger("create-room", { difficulty: "medium" });

      expect(socket.emit).toHaveBeenCalledWith("room-error", {
        message: "User not found. Complete onboarding first.",
      });
    });

    it("creates room, joins socket, and emits room-created", async () => {
      const dbUser = { id: "db_user_1", clerkId: "clerk_1", username: "alice", displayBird: "eagle" };
      mockPrisma.user.findUnique.mockResolvedValue(dbUser as any);

      const fakeRoom = { code: "ABCD", status: "waiting", hostUserId: "db_user_1" };
      roomManager.createRoom.mockReturnValue(fakeRoom);

      await socket._trigger("create-room", { difficulty: "short" });

      expect(roomManager.createRoom).toHaveBeenCalledWith(
        "db_user_1", "alice", "eagle", "sock-test", "short"
      );
      expect(socket.data.roomCode).toBe("ABCD");
      expect(socket.data.username).toBe("alice");
      expect(socket.data.displayBird).toBe("eagle");
      expect(socket.join).toHaveBeenCalledWith("ABCD");
      expect(socket.emit).toHaveBeenCalledWith("room-created", { roomCode: "ABCD" });
    });
  });

  describe("join-room", () => {
    it("registers the handler", () => {
      expect(socket.on).toHaveBeenCalledWith("join-room", expect.any(Function));
    });

    it("emits room-error when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await socket._trigger("join-room", { roomCode: "ABCD" });

      expect(socket.emit).toHaveBeenCalledWith("room-error", {
        message: "User not found. Complete onboarding first.",
      });
    });

    it("emits room-error when joinRoom fails", async () => {
      const dbUser = { id: "db_user_2", clerkId: "clerk_1", username: "bob", displayBird: "robin" };
      mockPrisma.user.findUnique.mockResolvedValue(dbUser as any);
      roomManager.joinRoom.mockReturnValue({ success: false, error: "Room is full" });

      await socket._trigger("join-room", { roomCode: "ABCD" });

      expect(socket.emit).toHaveBeenCalledWith("room-error", { message: "Room is full" });
    });

    it("joins room, emits player-joined and room-state on success", async () => {
      const dbUser = { id: "db_user_2", clerkId: "clerk_1", username: "bob", displayBird: "cardinal" };
      mockPrisma.user.findUnique.mockResolvedValue(dbUser as any);
      roomManager.joinRoom.mockReturnValue({ success: true });

      const players = new Map([
        ["host_1", { userId: "host_1", username: "alice", displayBird: "eagle", isHost: true, isConnected: true }],
        ["db_user_2", { userId: "db_user_2", username: "bob", displayBird: "cardinal", isHost: false, isConnected: true }],
      ]);
      const fakeRoom = {
        code: "ABCD",
        status: "waiting",
        hostUserId: "host_1",
        difficulty: "medium",
        players,
      };
      roomManager.getRoom.mockReturnValue(fakeRoom);

      await socket._trigger("join-room", { roomCode: "ABCD" });

      // Socket joins the room
      expect(socket.join).toHaveBeenCalledWith("ABCD");
      expect(socket.data.roomCode).toBe("ABCD");
      expect(socket.data.username).toBe("bob");
      expect(socket.data.displayBird).toBe("cardinal");

      // Broadcast player-joined to room
      expect(io.to).toHaveBeenCalledWith("ABCD");
      expect(io._emitFn).toHaveBeenCalledWith("player-joined", {
        userId: "db_user_2",
        username: "bob",
        displayBird: "cardinal",
      });

      // Send room-state to joining player
      expect(socket.emit).toHaveBeenCalledWith("room-state", {
        code: "ABCD",
        status: "waiting",
        hostUserId: "host_1",
        yourUserId: "db_user_2",
        difficulty: "medium",
        players: [
          { userId: "host_1", username: "alice", displayBird: "eagle", isHost: true, isConnected: true },
          { userId: "db_user_2", username: "bob", displayBird: "cardinal", isHost: false, isConnected: true },
        ],
      });
    });
  });
});
