import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RoomManager } from "../../src/rooms/room-manager.js";
import { prisma } from "../../src/lib/prisma.js";

describe("RoomManager.incrementEpoch", () => {
  let manager: RoomManager;
  let matchId: string;

  beforeEach(async () => {
    manager = new RoomManager();
    // Seed a Passage + Match for the test
    const passage = await prisma.passage.findFirst();
    if (!passage) throw new Error("Need at least one passage seeded");
    const match = await prisma.match.create({
      data: { roomCode: "EPOCH-TEST-" + Date.now(), passageId: passage.id, status: "racing" },
    });
    matchId = match.id;
  });

  afterEach(async () => {
    manager.destroy();
    await prisma.match.deleteMany({ where: { id: matchId } }).catch(() => {});
  });

  it("returns 1 on first call for a user, 2 on second", async () => {
    const first = await manager.incrementEpoch(matchId, "alice");
    const second = await manager.incrementEpoch(matchId, "alice");
    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  it("keys are independent per user", async () => {
    await manager.incrementEpoch(matchId, "alice");
    await manager.incrementEpoch(matchId, "alice");
    const bobFirst = await manager.incrementEpoch(matchId, "bob");
    expect(bobFirst).toBe(1);
  });

  it("throws if match not found", async () => {
    await expect(manager.incrementEpoch("does-not-exist", "alice")).rejects.toThrow();
  });
});
