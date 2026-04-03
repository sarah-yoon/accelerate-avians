import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RoomManager } from "./room-manager.js";

describe("RoomManager", () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
  });

  describe("createRoom", () => {
    it("creates a room and returns the code", () => {
      const room = manager.createRoom("user1", "alice", "robin", "socket1", "medium");
      expect(room.code).toMatch(/^[A-Z]+-\d{2}$/);
      expect(room.status).toBe("waiting");
      expect(room.hostUserId).toBe("user1");
      expect(room.difficulty).toBe("medium");
      expect(room.players.size).toBe(1);
      const player = room.players.get("user1");
      expect(player?.isHost).toBe(true);
      expect(player?.username).toBe("alice");
    });

    it("creates rooms with unique codes", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const room = manager.createRoom(`user${i}`, `name${i}`, "robin", `sock${i}`, "short");
        codes.add(room.code);
      }
      expect(codes.size).toBe(20);
    });
  });

  describe("joinRoom", () => {
    it("adds a player to an existing room", () => {
      const room = manager.createRoom("host", "hostName", "robin", "sock1", "short");
      const result = manager.joinRoom(room.code, "user2", "bob", "canary", "sock2");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.room.players.size).toBe(2);
        const player = result.room.players.get("user2");
        expect(player?.username).toBe("bob");
        expect(player?.isHost).toBe(false);
      }
    });

    it("rejects joining a nonexistent room", () => {
      const result = manager.joinRoom("BADCODE", "user2", "bob", "canary", "sock2");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Room not found or expired");
      }
    });

    it("rejects joining a full room (6 players)", () => {
      const room = manager.createRoom("host", "hostName", "robin", "sock0", "short");
      for (let i = 1; i < 6; i++) {
        manager.joinRoom(room.code, `user${i}`, `name${i}`, "robin", `sock${i}`);
      }
      const result = manager.joinRoom(room.code, "user6", "name6", "robin", "sock6");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Room is full");
      }
    });

    it("rejects joining a room that is already racing", () => {
      const room = manager.createRoom("host", "hostName", "robin", "sock0", "short");
      manager.joinRoom(room.code, "user2", "name2", "robin", "sock2");
      manager.setRoomStatus(room.code, "racing");
      const result = manager.joinRoom(room.code, "user3", "name3", "robin", "sock3");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Race already in progress");
      }
    });

    it("rejects duplicate user in same room", () => {
      const room = manager.createRoom("host", "hostName", "robin", "sock0", "short");
      const result = manager.joinRoom(room.code, "host", "hostName", "robin", "sock1");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Already in this room");
      }
    });
  });

  describe("removePlayer", () => {
    it("removes a player from the room", () => {
      const room = manager.createRoom("host", "hostName", "robin", "sock0", "short");
      manager.joinRoom(room.code, "user2", "bob", "canary", "sock2");
      manager.removePlayer(room.code, "user2");
      expect(room.players.size).toBe(1);
      expect(room.players.has("user2")).toBe(false);
    });

    it("transfers host to oldest player when host leaves pre-race", () => {
      const room = manager.createRoom("host", "hostName", "robin", "sock0", "short");
      manager.joinRoom(room.code, "user2", "bob", "canary", "sock2");
      manager.joinRoom(room.code, "user3", "carol", "bluebird", "sock3");
      const result = manager.removePlayer(room.code, "host");
      expect(result?.newHostUserId).toBe("user2");
      expect(room.hostUserId).toBe("user2");
      expect(room.players.get("user2")?.isHost).toBe(true);
    });

    it("deletes room when last player leaves", () => {
      const room = manager.createRoom("host", "hostName", "robin", "sock0", "short");
      manager.removePlayer(room.code, "host");
      expect(manager.getRoom(room.code)).toBeUndefined();
    });
  });

  describe("disconnectPlayer", () => {
    it("marks player as disconnected with timestamp", () => {
      const room = manager.createRoom("host", "hostName", "robin", "sock0", "short");
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      manager.disconnectPlayer(room.code, "host");
      const player = room.players.get("host");
      expect(player?.isConnected).toBe(false);
      expect(player?.disconnectedAt).toBe(Date.now());
    });
  });

  describe("reconnectPlayer", () => {
    it("reconnects a disconnected player with new socketId", () => {
      const room = manager.createRoom("host", "hostName", "robin", "sock0", "short");
      manager.disconnectPlayer(room.code, "host");
      const result = manager.reconnectPlayer(room.code, "host", "sock-new");
      expect(result).toBe(true);
      const player = room.players.get("host");
      expect(player?.isConnected).toBe(true);
      expect(player?.socketId).toBe("sock-new");
      expect(player?.disconnectedAt).toBeNull();
    });

    it("returns false for player not in room", () => {
      const room = manager.createRoom("host", "hostName", "robin", "sock0", "short");
      const result = manager.reconnectPlayer(room.code, "unknown", "sock-new");
      expect(result).toBe(false);
    });
  });

  describe("expiry", () => {
    it("expires rooms after 10 minutes of inactivity", () => {
      const room = manager.createRoom("host", "hostName", "robin", "sock0", "short");
      const code = room.code;
      // Advance time by 10 minutes + 1ms
      vi.advanceTimersByTime(10 * 60 * 1000 + 1);
      manager.cleanupExpiredRooms();
      expect(manager.getRoom(code)).toBeUndefined();
    });

    it("does not expire active rooms", () => {
      const room = manager.createRoom("host", "hostName", "robin", "sock0", "short");
      const code = room.code;
      vi.advanceTimersByTime(5 * 60 * 1000);
      manager.touchRoom(code);
      vi.advanceTimersByTime(5 * 60 * 1000);
      manager.cleanupExpiredRooms();
      expect(manager.getRoom(code)).toBeDefined();
    });
  });
});
