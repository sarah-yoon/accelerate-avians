#!/usr/bin/env tsx
/**
 * connection-churn benchmark: stress-test raw-WS lifecycle cleanup.
 *
 * Opens 200 sequential raw WebSocket connections against the /loadtest
 * endpoint (each does join-room + a few progress messages + close), then
 * samples server RSS and FD count before/after.
 *
 * NOT a test of the Socket.IO connection path (which requires Clerk auth);
 * Socket.IO cleanup is verified by unit tests. This catches process-level
 * leaks in the raw-WS endpoint and the server's general steady-state.
 *
 * Prereq: server running on :3001 with LOADTEST_ENDPOINT=1.
 *
 * Run: SERVER_PID=<pid> npx tsx scripts/load-test/connection-churn.ts
 */
import { spawnSync } from "node:child_process";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error no @types/ws installed; this script runs via tsx, not compiled.
import WebSocket from "ws";

const ITERATIONS = 200;
const SETTLE_MS = 5_000;

function sampleRssBytes(pid: number): number | null {
  const out = spawnSync("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf8" });
  const kb = Number(out.stdout.trim());
  return Number.isFinite(kb) ? kb * 1024 : null;
}

function sampleFdCount(pid: number): number | null {
  const out = spawnSync("bash", ["-lc", `lsof -p ${pid} 2>/dev/null | wc -l`], { encoding: "utf8" });
  const n = Number(out.stdout.trim());
  return Number.isFinite(n) ? n : null;
}

function resolveServerPid(): number {
  const fromEnv = Number(process.env.SERVER_PID);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  const pidFile = spawnSync("bash", ["-lc", "cat /tmp/aa-server.pid 2>/dev/null"], { encoding: "utf8" });
  const fromFile = Number(pidFile.stdout.trim());
  if (Number.isFinite(fromFile) && fromFile > 0) return fromFile;
  throw new Error("SERVER_PID not set and /tmp/aa-server.pid missing");
}

async function churnOnce(target: string, userId: string, roomCode: string): Promise<void> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${target}/loadtest`);
    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      try { ws.close(); } catch { /* ignore */ }
      resolve();
    };
    const timer = setTimeout(finish, 2_000);
    ws.on("open", () => {
      ws.send(JSON.stringify({ kind: "join-room", roomCode, userId }));
      // Send a few progress messages then close.
      for (let i = 0; i < 5; i++) {
        ws.send(JSON.stringify({ kind: "typing-progress", charIndex: i + 1, sentAt: Date.now() }));
      }
      setTimeout(() => {
        clearTimeout(timer);
        finish();
      }, 50);
    });
    ws.on("error", () => {
      clearTimeout(timer);
      finish();
    });
    ws.on("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main() {
  const pid = resolveServerPid();
  const target = process.env.TARGET_URL ?? "ws://localhost:3001";

  const rssBefore = sampleRssBytes(pid);
  const fdBefore = sampleFdCount(pid);
  if (rssBefore === null || fdBefore === null) {
    throw new Error(`Failed to sample server metrics — PID ${pid} not running?`);
  }
  console.log(`Target: ${target} (PID ${pid})`);
  console.log(`Before: RSS = ${(rssBefore / 1024 / 1024).toFixed(1)} MB, FD = ${fdBefore}`);
  console.log(`\nRunning ${ITERATIONS} raw-WS connect → disconnect cycles (sequential)…`);

  const startedAt = Date.now();
  for (let i = 0; i < ITERATIONS; i++) {
    await churnOnce(target, `churn-user-${i}`, `churn-room-${i}`);
  }
  const elapsed = Date.now() - startedAt;
  console.log(`${ITERATIONS} cycles in ${elapsed} ms (${(ITERATIONS / (elapsed / 1000)).toFixed(1)} cycles/s)`);

  console.log(`\nWaiting ${SETTLE_MS} ms for server to settle…`);
  await new Promise((r) => setTimeout(r, SETTLE_MS));

  const rssAfter = sampleRssBytes(pid);
  const fdAfter = sampleFdCount(pid);
  if (rssAfter === null || fdAfter === null) {
    throw new Error("Failed to sample server metrics post-churn (crashed?)");
  }

  const rssDeltaMb = (rssAfter - rssBefore) / 1024 / 1024;
  const fdDelta = fdAfter - fdBefore;

  console.log(`\nAfter:  RSS = ${(rssAfter / 1024 / 1024).toFixed(1)} MB, FD = ${fdAfter}`);
  console.log(`Delta:  RSS = ${rssDeltaMb.toFixed(1)} MB, FD = ${fdDelta}`);
  console.log(`\nThresholds (adapted from spec § 2.5.3):`);
  console.log(`  RSS growth < 10 MB → ${rssDeltaMb < 10 ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`  FD  growth < 50    → ${fdDelta < 50 ? "PASS ✓" : "FAIL ✗"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
