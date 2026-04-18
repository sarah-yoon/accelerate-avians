import { describe, it, expect, vi } from "vitest";
import { emitWithServerTime } from "./clock-broadcast.js";

describe("clock-broadcast", () => {
  it("emitWithServerTime attaches performance.now() as serverTime", () => {
    const socket = { emit: vi.fn() };
    emitWithServerTime(socket as any, "player-progress", { players: [] });
    const [eventName, payload] = socket.emit.mock.calls[0];
    expect(eventName).toBe("player-progress");
    expect(typeof payload.serverTime).toBe("number");
    expect(payload.players).toEqual([]);
  });
});
