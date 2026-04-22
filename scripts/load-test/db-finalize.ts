#!/usr/bin/env tsx
/**
 * db-finalize benchmark: simulate 200 rooms finishing within a 5-second
 * window by firing 800 concurrent matchPlayer.updateMany calls against
 * the real Postgres — matches the production "player-finished" hot path
 * under peak contention.
 *
 * Measures: per-call latency distribution (p50/p95/p99) and total wall-clock
 * time. Compares against the § 2.5.3 threshold of p99 < 500 ms.
 *
 * Setup: creates a throwaway Match + 800 MatchPlayer rows tied to ephemeral
 * test user IDs. Cleans up afterward.
 *
 * Run: npx tsx scripts/load-test/db-finalize.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const N_ROOMS = 200;
const PLAYERS_PER_ROOM = 4;
const TOTAL_PLAYERS = N_ROOMS * PLAYERS_PER_ROOM;
const FINISH_WINDOW_MS = 5_000;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  console.log(`Setting up ${N_ROOMS} rooms × ${PLAYERS_PER_ROOM} players = ${TOTAL_PLAYERS} rows…`);

  // Fixture: one passage + one User per test run (bot_ prefix → excluded from leaderboards).
  const passage = await prisma.passage.findFirst();
  if (!passage) throw new Error("No passage seeded in DB");

  const testRunId = `dbfin-${Date.now()}`;
  const botUserIds: string[] = [];
  for (let i = 0; i < TOTAL_PLAYERS; i++) {
    const clerkId = `bot_${testRunId}_${i}`;
    const user = await prisma.user.upsert({
      where: { clerkId },
      create: { clerkId, username: clerkId, displayBird: "robin" },
      update: {},
    });
    botUserIds.push(user.id);
  }

  // Create one Match (the update target is by matchId+userId, so one Match is fine —
  // real production has one Match per room but the query contention path is identical).
  const match = await prisma.match.create({
    data: {
      roomCode: `DBFIN-${testRunId}`,
      passageId: passage.id,
      status: "racing",
      startedAt: new Date(),
    },
  });

  await prisma.matchPlayer.createMany({
    data: botUserIds.map((userId) => ({
      matchId: match.id,
      userId,
      status: "racing" as const,
    })),
  });

  console.log(`Setup complete. Match: ${match.id}\n`);
  console.log(`Firing ${TOTAL_PLAYERS} concurrent matchPlayer.updateMany calls (jittered over ${FINISH_WINDOW_MS} ms)…`);

  const latencies: number[] = [];
  const startedAt = Date.now();

  // Jitter each call uniformly across the 5s window to mimic real finishes.
  const promises = botUserIds.map(async (userId, i) => {
    const delay = (Math.random() * FINISH_WINDOW_MS) | 0;
    await new Promise((r) => setTimeout(r, delay));
    const t0 = performance.now();
    await prisma.matchPlayer.updateMany({
      where: { matchId: match.id, userId },
      data: {
        wpm: 60,
        accuracy: 0.95,
        placement: i + 1,
        clientGhostData: [{ charIndex: 0, ms: 0 }, { charIndex: 50, ms: 5000 }] as never,
        serverGhost: [{ charIndex: 0, serverMs: 0 }, { charIndex: 50, serverMs: 5000 }] as never,
        flagged: false,
        status: "finished",
        finishedAt: new Date(),
      },
    });
    latencies.push(performance.now() - t0);
  });

  await Promise.all(promises);
  const wallClockMs = Date.now() - startedAt;

  latencies.sort((a, b) => a - b);
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const max = latencies[latencies.length - 1];

  console.log(`\nWall clock: ${wallClockMs} ms`);
  console.log(`Per-call latency (n=${latencies.length}):`);
  console.log(`  p50 = ${p50.toFixed(1)} ms`);
  console.log(`  p95 = ${p95.toFixed(1)} ms`);
  console.log(`  p99 = ${p99.toFixed(1)} ms`);
  console.log(`  max = ${max.toFixed(1)} ms`);
  console.log(`\nThreshold: p99 < 500 ms → ${p99 < 500 ? "PASS ✓" : "FAIL ✗"}`);

  // Cleanup
  console.log(`\nCleaning up…`);
  await prisma.matchPlayer.deleteMany({ where: { matchId: match.id } });
  await prisma.match.delete({ where: { id: match.id } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: `bot_${testRunId}_` } } });
  await prisma.$disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
