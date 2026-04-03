import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("socket.io-client", () => {
  const handlers = new Map<string, Function>();
  const mockSocket = {
    connected: false,
    on: vi.fn((event: string, handler: Function) => {
      handlers.set(event, handler);
    }),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    io: { on: vi.fn(), off: vi.fn() },
    _trigger: (event: string, ...args: any[]) => handlers.get(event)?.(...args),
  };
  return {
    io: vi.fn(() => mockSocket),
    __mockSocket: mockSocket,
  };
});

import { getSocket, disconnectSocket } from "@/lib/socket";
import { io, __mockSocket } from "socket.io-client";

const mockIo = io as unknown as ReturnType<typeof vi.fn>;
const mockSocket = __mockSocket as any;

describe("socket", () => {
  beforeEach(() => {
    // Reset module-level socket reference by disconnecting
    disconnectSocket();
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  describe("getSocket", () => {
    it("creates a new socket with auth token", () => {
      const socket = getSocket("test-token-123");

      expect(mockIo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token: "test-token-123" },
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        })
      );
      expect(socket).toBe(mockSocket);
    });

    it("returns existing socket if connected", () => {
      const socket1 = getSocket("token-1");
      mockSocket.connected = true;

      const socket2 = getSocket("token-2");

      // Should NOT have created a new socket the second time
      expect(mockIo).toHaveBeenCalledTimes(1);
      expect(socket2).toBe(socket1);
    });

    it("creates a new socket if existing one is disconnected", () => {
      getSocket("token-1");
      // socket.connected is still false (default)

      getSocket("token-2");

      expect(mockIo).toHaveBeenCalledTimes(2);
    });
  });

  describe("disconnectSocket", () => {
    it("calls disconnect on the socket", () => {
      getSocket("token");

      disconnectSocket();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("sets socket to null so next getSocket creates a new one", () => {
      getSocket("token-1");
      disconnectSocket();
      vi.clearAllMocks();

      getSocket("token-2");

      expect(mockIo).toHaveBeenCalledTimes(1);
      expect(mockIo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token: "token-2" },
        })
      );
    });

    it("does nothing if no socket exists", () => {
      // Should not throw
      disconnectSocket();
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });
  });
});
