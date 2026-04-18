import { describe, it, expect, vi } from "vitest";
import { emitWithServerTime, TimeSyncTracker } from "./clock-broadcast.js";

describe("clock-broadcast", () => {
  it("emitWithServerTime attaches performance.now() as serverTime", () => {
    const socket = { emit: vi.fn() };
    emitWithServerTime(socket as any, "player-progress", { players: [] });
    const [eventName, payload] = socket.emit.mock.calls[0];
    expect(eventName).toBe("player-progress");
    expect(typeof payload.serverTime).toBe("number");
    expect(payload.players).toEqual([]);
  });

  it("TimeSyncTracker allows only one handshake per socket lifetime", () => {
    const t = new TimeSyncTracker();
    expect(t.allow("socket-1")).toBe(true);
    expect(t.allow("socket-1")).toBe(false);
    expect(t.allow("socket-2")).toBe(true);
  });

  it("TimeSyncTracker.release lets a socketId handshake again", () => {
    const t = new TimeSyncTracker();
    expect(t.allow("s1")).toBe(true);
    t.release("s1");
    expect(t.allow("s1")).toBe(true);
  });
});
