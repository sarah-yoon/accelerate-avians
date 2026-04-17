# Phase 1 — Server-Authoritative Scoring (Multiplayer)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make multiplayer race scoring (WPM, accuracy) derive from server-stamped progress events instead of client-supplied keystroke timing data, so the "server-authoritative" claim in the resume bullet is true.

**Architecture:** The Socket.IO game server already receives `typing-progress` events on every keystroke. Today their arrival timestamps are discarded — final WPM is computed from client `ghostData` sent in `player-finished`. After this change, the server records `serverReceivedAt = performance.now()` for every progress event into a per-player `serverGhost` array stored on the race state, and `playerFinished` derives WPM from that array. Client `ghostData` is preserved (renamed `clientGhostData`) but used only for the existing solo-mode replay visualization. Solo races continue to be server-validated (math runs in `/api/scores`) but use client-supplied input — this scope distinction is documented honestly.

**Tech Stack:** Express + Socket.IO server (Node 20, TypeScript, Vitest), Next.js 16 frontend, Prisma 5 / PostgreSQL.

**Spec section:** § 2.0 of `docs/superpowers/specs/2026-04-16-netcode-and-polish-design.md`.

---

## File Structure

Files modified or created in Phase 1:

| Path | Change | Responsibility |
|------|--------|----------------|
| `server/src/types.ts` | modify | Add `ServerGhostPoint` type |
| `server/src/race/race-controller.ts` | modify | Track race-start in `performance.now()` terms, build per-player `serverGhost`, derive WPM from it in `playerFinished` |
| `server/src/race/race-controller.test.ts` | modify | New tests for serverGhost behavior |
| `server/src/handlers/race-handlers.ts` | modify | Stop forwarding client `ghostData` into scoring path; persist `clientGhostData` + `serverGhost` + `flagged` to DB |
| `server/src/handlers/race-handlers.test.ts` | modify | Update tests for new handler signature |
| `server/src/lib/score-calculator.ts` | modify | Rename param `ghostData` → `progressSamples` (semantic only; math unchanged) |
| `server/src/lib/score-calculator.test.ts` | modify | Rename in tests |
| `prisma/schema.prisma` | modify | Rename `Score.ghostData` → `clientGhostData`; add `Score.serverGhost Json?`, `Score.flagged Boolean @default(false)`; same on `MatchPlayer` |
| `server/prisma/schema.prisma` | modify | Same as above (server has its own Prisma client) |
| `prisma/migrations/<new>/migration.sql` | new | Generated migration |
| `src/types/index.ts` | modify | Rename in shared types |
| `src/lib/score-validator.ts` | modify | Rename param/field references |
| `src/app/api/scores/route.ts` | modify | Use `clientGhostData` field name on write; semantics unchanged for solo |
| `src/app/api/passages/[id]/ghosts/route.ts` | modify | Read `clientGhostData` for replays |
| `src/hooks/useRace.ts`, `useTyping.ts`, `useMultiplayerRace.ts` | modify | Send field renamed where it appears in client→server payloads |
| `src/components/typing/typing-engine.ts` | modify | Local field name rename |
| `src/components/race/race-renderer.ts`, `RaceCanvas.tsx`, `lobby/LobbyRace.tsx` | modify | Read replay data via new field name |
| `prisma/seed.ts` | modify | Field rename on seed data |
| All affected `tests/` and `server/tests/` | modify | Field rename + new tests |
| `README.md` | modify | One-paragraph note: "scoring is server-authoritative for multiplayer; solo is server-validated" |

This is a wide rename (31 callers) plus localized server-side logic changes. Tasks are organized so the rename happens in one TDD-light pass (Task 8) once the server logic is settled, to avoid rebasing renames against logic changes.

---

## Task 1: Add `ServerGhostPoint` type

**Files:**
- Modify: `server/src/types.ts`

- [ ] **Step 1: Add the type**

Append to `server/src/types.ts`:

```ts
export interface ServerGhostPoint {
  charIndex: number;
  serverMs: number;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd server && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/types.ts
git commit -m "feat(types): add ServerGhostPoint type"
```

---

## Task 2: RaceController records `serverGhost` on every progress update

**Files:**
- Modify: `server/src/race/race-controller.ts`
- Test: `server/src/race/race-controller.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `server/src/race/race-controller.test.ts` (after the existing `describe`):

```ts
describe("RaceController serverGhost", () => {
  it("records a serverGhost sample on every updateCharIndex with monotonic serverMs", async () => {
    const controller = new RaceController(() => {});
    const room = makeRoom(["alice", "bob"]); // helper that builds Room with two connected players
    controller.startRace(room, { id: "p1", text: "hello world", charCount: 11, wordCount: 2 });

    controller.updateCharIndex(room.code, "alice", 1);
    await new Promise((r) => setTimeout(r, 5));
    controller.updateCharIndex(room.code, "alice", 3);

    const samples = controller.getServerGhost(room.code, "alice");
    expect(samples).toHaveLength(2);
    expect(samples[0].charIndex).toBe(1);
    expect(samples[1].charIndex).toBe(3);
    expect(samples[1].serverMs).toBeGreaterThan(samples[0].serverMs);
  });
});
```

If `makeRoom` doesn't exist in this test file, copy the existing room construction helper from `server/src/race/race-controller.test.ts` (it appears in the existing `describe` block above).

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd server && npx vitest run src/race/race-controller.test.ts -t "serverGhost"`
Expected: FAIL — `controller.getServerGhost is not a function`.

- [ ] **Step 3: Add `serverGhost` field to `RaceState`**

In `server/src/race/race-controller.ts`, add to the `RaceState` interface:

```ts
import type { ServerGhostPoint } from "../types.js";

interface RaceState {
  passageCharCount: number;
  passageWordCount: number;
  playerCharIndices: Map<string, number>;
  serverGhost: Map<string, ServerGhostPoint[]>;     // NEW
  raceStartedAtPerfNow: number;                      // NEW — for serverMs deltas
  finishedPlayers: Map<
    string,
    { placement: number; wpm: number; accuracy: number; ghostData: Array<{ charIndex: number; ms: number }> }
  >;
  nextPlacement: number;
}
```

- [ ] **Step 4: Initialize the new fields in `startRace`**

In `RaceController.startRace`, modify the `raceStates.set(...)` block:

```ts
const playerCharIndices = new Map<string, number>();
const serverGhost = new Map<string, ServerGhostPoint[]>();
for (const player of room.players.values()) {
  playerCharIndices.set(player.userId, 0);
  serverGhost.set(player.userId, []);
}

this.raceStates.set(room.code, {
  passageCharCount: passage.charCount,
  passageWordCount: passage.wordCount,
  playerCharIndices,
  serverGhost,
  raceStartedAtPerfNow: performance.now(),
  finishedPlayers: new Map(),
  nextPlacement: 1,
});
```

- [ ] **Step 5: Record samples in `updateCharIndex`**

Replace the body of `updateCharIndex` with:

```ts
updateCharIndex(roomCode: string, userId: string, charIndex: number): void {
  const state = this.raceStates.get(roomCode);
  if (!state) return;
  state.playerCharIndices.set(userId, charIndex);

  const samples = state.serverGhost.get(userId);
  if (samples) {
    samples.push({
      charIndex,
      serverMs: performance.now() - state.raceStartedAtPerfNow,
    });
  }
}
```

- [ ] **Step 6: Add `getServerGhost` accessor**

Add this method to `RaceController`:

```ts
getServerGhost(roomCode: string, userId: string): ServerGhostPoint[] {
  const state = this.raceStates.get(roomCode);
  if (!state) return [];
  return state.serverGhost.get(userId) ?? [];
}
```

- [ ] **Step 7: Run the test and verify it passes**

Run: `cd server && npx vitest run src/race/race-controller.test.ts -t "serverGhost"`
Expected: PASS.

- [ ] **Step 8: Run the full controller test file to confirm no regression**

Run: `cd server && npx vitest run src/race/race-controller.test.ts`
Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add server/src/race/race-controller.ts server/src/race/race-controller.test.ts
git commit -m "feat(race): record serverGhost on every progress update"
```

---

## Task 3: `score-calculator` accepts generic `progressSamples`

The math is identical (WPM = words / elapsed-ms × 60000). Only the input parameter is renamed and the input type made generic enough to accept either client `GhostDataPoint` or server `ServerGhostPoint`.

**Files:**
- Modify: `server/src/lib/score-calculator.ts`
- Test: `server/src/lib/score-calculator.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `server/src/lib/score-calculator.test.ts`:

```ts
it("derives WPM from server-stamped samples when given serverGhost shape", () => {
  const samples = [
    { charIndex: 0, serverMs: 0 },
    { charIndex: 5, serverMs: 1500 },
    { charIndex: 10, serverMs: 3000 },
  ];
  const result = calculateResults(samples, /* wordCount */ 2, 10, 10);
  // 2 words / 3000ms × 60000 = 40
  expect(result.wpm).toBe(40);
  expect(result.accuracy).toBe(1);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd server && npx vitest run src/lib/score-calculator.test.ts -t "serverGhost shape"`
Expected: FAIL — TypeScript error or wrong result, depending on current signature.

- [ ] **Step 3: Generalize the calculator**

Rewrite `server/src/lib/score-calculator.ts`:

```ts
interface ProgressSample {
  charIndex: number;
  ms?: number;          // legacy client field
  serverMs?: number;    // new server field
}

interface RaceResult {
  wpm: number;
  accuracy: number;
}

export function calculateResults(
  progressSamples: ProgressSample[],
  wordCount: number,
  correctKeystrokes: number,
  totalKeystrokes: number
): RaceResult {
  let wpm = 0;
  if (progressSamples.length >= 2) {
    const stamp = (s: ProgressSample) => s.serverMs ?? s.ms ?? 0;
    const elapsedMs = stamp(progressSamples[progressSamples.length - 1]) - stamp(progressSamples[0]);
    if (elapsedMs > 0) {
      wpm = Math.round((wordCount / elapsedMs) * 60000);
    }
  }
  const accuracy = totalKeystrokes > 0 ? correctKeystrokes / totalKeystrokes : 0;
  return { wpm, accuracy };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `cd server && npx vitest run src/lib/score-calculator.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/score-calculator.ts server/src/lib/score-calculator.test.ts
git commit -m "refactor(score): accept either client or server timing samples"
```

---

## Task 4: `playerFinished` derives WPM from `serverGhost`, not client data

**Files:**
- Modify: `server/src/race/race-controller.ts`
- Test: `server/src/race/race-controller.test.ts`

- [ ] **Step 1: Write the failing test (proves the cheating-protection contract)**

Append to `race-controller.test.ts`:

```ts
it("derives final WPM from serverGhost, ignoring client-supplied ghostData", async () => {
  const controller = new RaceController(() => {});
  const room = makeRoom(["alice", "bob"]);
  controller.startRace(room, { id: "p1", text: "twenty char passage.", charCount: 20, wordCount: 4 });

  // Simulate 4 seconds of real typing on the server: 5 chars/sec
  for (let i = 1; i <= 20; i++) {
    controller.updateCharIndex(room.code, "alice", i);
    await new Promise((r) => setTimeout(r, 200));
  }

  // Client lies: claims it took 1 second (would be 240 WPM)
  const result = controller.playerFinished(room.code, "alice", {
    ghostData: [{ charIndex: 0, ms: 0 }, { charIndex: 20, ms: 1000 }],
    correctKeystrokes: 20,
    totalKeystrokes: 20,
  });

  expect(result).not.toBeNull();
  // Real WPM ≈ 4 words / 4000ms × 60000 ≈ 60. Allow ±10 for timer jitter.
  expect(result!.wpm).toBeGreaterThan(50);
  expect(result!.wpm).toBeLessThan(70);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd server && npx vitest run src/race/race-controller.test.ts -t "ignoring client-supplied"`
Expected: FAIL — `result.wpm` is 240 (computed from client data) instead of ~60.

- [ ] **Step 3: Modify `playerFinished` to use `serverGhost`**

In `server/src/race/race-controller.ts`, replace the body of `playerFinished`:

```ts
playerFinished(
  roomCode: string,
  userId: string,
  data: FinishData
): PlayerFinishResult | null {
  const state = this.raceStates.get(roomCode);
  if (!state) return null;
  if (state.finishedPlayers.has(userId)) return null;

  const serverSamples = state.serverGhost.get(userId) ?? [];

  const { wpm, accuracy } = calculateResults(
    serverSamples,                          // server-derived input
    state.passageWordCount,
    data.correctKeystrokes,
    data.totalKeystrokes
  );

  const placement = state.nextPlacement;
  state.nextPlacement++;

  state.finishedPlayers.set(userId, {
    placement,
    wpm,
    accuracy,
    ghostData: data.ghostData,              // preserved as clientGhostData for replay only
  });

  return { placement, wpm, accuracy };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `cd server && npx vitest run src/race/race-controller.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/race/race-controller.ts server/src/race/race-controller.test.ts
git commit -m "feat(race): derive final WPM from server-stamped progress, not client data"
```

---

## Task 5: Expose `serverGhost` to the handler for DB persistence

**Files:**
- Modify: `server/src/race/race-controller.ts`
- Test: `server/src/race/race-controller.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("getFinishedPlayerData returns serverGhost alongside client data", () => {
  const controller = new RaceController(() => {});
  const room = makeRoom(["alice", "bob"]);
  controller.startRace(room, { id: "p1", text: "hello", charCount: 5, wordCount: 1 });
  controller.updateCharIndex(room.code, "alice", 5);
  controller.playerFinished(room.code, "alice", {
    ghostData: [{ charIndex: 0, ms: 0 }, { charIndex: 5, ms: 100 }],
    correctKeystrokes: 5,
    totalKeystrokes: 5,
  });

  const data = controller.getFinishedPlayerData(room.code, "alice");
  expect(data).not.toBeNull();
  expect(data!.serverGhost).toBeDefined();
  expect(data!.serverGhost.length).toBeGreaterThan(0);
  expect(data!.clientGhostData).toEqual([{ charIndex: 0, ms: 0 }, { charIndex: 5, ms: 100 }]);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd server && npx vitest run src/race/race-controller.test.ts -t "serverGhost alongside client data"`
Expected: FAIL — `data.serverGhost is undefined`.

- [ ] **Step 3: Update `RaceState.finishedPlayers` shape and `getFinishedPlayerData`**

In `RaceState`, change the `finishedPlayers` value type:

```ts
finishedPlayers: Map<
  string,
  {
    placement: number;
    wpm: number;
    accuracy: number;
    clientGhostData: Array<{ charIndex: number; ms: number }>;
    serverGhost: ServerGhostPoint[];
  }
>;
```

In `playerFinished`, change the `state.finishedPlayers.set(...)` call:

```ts
state.finishedPlayers.set(userId, {
  placement,
  wpm,
  accuracy,
  clientGhostData: data.ghostData,
  serverGhost: serverSamples.slice(),  // copy so post-finish updates don't mutate
});
```

Replace `getFinishedPlayerData`:

```ts
getFinishedPlayerData(
  roomCode: string,
  userId: string
): {
  wpm: number;
  accuracy: number;
  clientGhostData: Array<{ charIndex: number; ms: number }>;
  serverGhost: ServerGhostPoint[];
} | null {
  const state = this.raceStates.get(roomCode);
  if (!state) return null;
  const data = state.finishedPlayers.get(userId);
  if (!data) return null;
  return {
    wpm: data.wpm,
    accuracy: data.accuracy,
    clientGhostData: data.clientGhostData,
    serverGhost: data.serverGhost,
  };
}
```

- [ ] **Step 4: Run the full controller test file**

Run: `cd server && npx vitest run src/race/race-controller.test.ts`
Expected: all tests PASS. (Other tests that read `data.ghostData` from `getFinishedPlayerData` will need updating — fix any that break.)

- [ ] **Step 5: Commit**

```bash
git add server/src/race/race-controller.ts server/src/race/race-controller.test.ts
git commit -m "feat(race): expose serverGhost + clientGhostData from getFinishedPlayerData"
```

---

## Task 6: Prisma schema rename + new fields

The repo has two Prisma schemas (root and `server/`) that share the same DB. They must stay in sync.

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `server/prisma/schema.prisma`
- New: `prisma/migrations/<timestamp>_server_authoritative_scoring/migration.sql`

- [ ] **Step 1: Edit `prisma/schema.prisma`**

In the `Score` model, replace `ghostData Json` with:

```prisma
clientGhostData Json
serverGhost     Json?
flagged         Boolean @default(false)
```

In the `MatchPlayer` model, replace `ghostData Json?` with:

```prisma
clientGhostData Json?
serverGhost     Json?
flagged         Boolean @default(false)
```

- [ ] **Step 2: Mirror the same edits to `server/prisma/schema.prisma`**

Apply the same changes.

- [ ] **Step 3: Generate and apply migration**

Run: `cd /Users/student/Documents/accelerate-avians && npx prisma migrate dev --name server_authoritative_scoring`
Expected: migration generated under `prisma/migrations/`, applied to local DB. Prisma client regenerated.

If Prisma proposes a destructive migration (drops `ghostData`), **edit the generated SQL** to use `ALTER TABLE ... RENAME COLUMN ghostData TO clientGhostData` for both `scores` and `match_players` and **then** add the two new columns. Re-run migrate.

- [ ] **Step 4: Regenerate the server's Prisma client**

Run: `cd /Users/student/Documents/accelerate-avians/server && npx prisma generate`
Expected: `@prisma/client` updated for the server.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations server/prisma/schema.prisma
git commit -m "feat(db): rename ghostData→clientGhostData; add serverGhost, flagged"
```

---

## Task 7: `race-handlers` writes both ghosts + flagged on `MatchPlayer`

**Files:**
- Modify: `server/src/handlers/race-handlers.ts`
- Test: `server/src/handlers/race-handlers.test.ts`

- [ ] **Step 1: Write the failing test**

In `race-handlers.test.ts`, add:

```ts
it("persists clientGhostData + serverGhost + flagged=false on MatchPlayer at finish", async () => {
  // arrange: a match in progress with two players, alice has typed; bob hasn't finished
  const { socketAlice, prismaMock, raceController } = await setupTestRace();
  // simulate alice progress on the controller
  raceController.updateCharIndex("ROOM1", "alice", 5);

  // act: client emits player-finished with ghostData
  await socketAlice.emit("player-finished", {
    ghostData: [{ charIndex: 0, ms: 0 }, { charIndex: 5, ms: 100 }],
    correctKeystrokes: 5,
    totalKeystrokes: 5,
  });

  // assert: matchPlayer updated with both ghost fields
  const updateCall = prismaMock.matchPlayer.updateMany.mock.calls.at(-1)?.[0];
  expect(updateCall.data.clientGhostData).toEqual([{ charIndex: 0, ms: 0 }, { charIndex: 5, ms: 100 }]);
  expect(updateCall.data.serverGhost).toBeDefined();
  expect(Array.isArray(updateCall.data.serverGhost)).toBe(true);
  expect(updateCall.data.flagged).toBe(false);
});
```

If `setupTestRace` doesn't exist as a helper, build it inline using the existing test patterns in this file (mock socket, mock prisma, RaceController + RoomManager instances).

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd server && npx vitest run src/handlers/race-handlers.test.ts -t "persists clientGhostData"`
Expected: FAIL — current handler writes `ghostData`, not `clientGhostData`.

- [ ] **Step 3: Modify the `player-finished` handler**

In `server/src/handlers/race-handlers.ts`, locate the `socket.on("player-finished", ...)` block. Replace the `prisma.matchPlayer.updateMany({...})` call with:

```ts
const finishedData = raceController.getFinishedPlayerData(roomCode, userId);

await prisma.matchPlayer.updateMany({
  where: { matchId: match.id, userId },
  data: {
    wpm: finishResult.wpm,
    accuracy: finishResult.accuracy,
    placement: finishResult.placement,
    clientGhostData: ghostData as never,
    serverGhost: (finishedData?.serverGhost ?? []) as never,
    flagged: false,
    status: "finished",
    finishedAt: new Date(),
  },
});
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `cd server && npx vitest run src/handlers/race-handlers.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/handlers/race-handlers.ts server/src/handlers/race-handlers.test.ts
git commit -m "feat(handlers): persist clientGhostData + serverGhost on MatchPlayer"
```

---

## Task 8: Frontend & solo-API field rename pass

This is a wide find-and-replace across the Next.js side of the project. Solo race semantics do **not** change — solo continues to derive WPM client-side and POST it through `/api/scores`. We only rename the *field*, both in payloads and in DB writes, so the schema and the codebase stay consistent.

**Files (full list):**
- `src/types/index.ts`
- `src/lib/score-validator.ts`
- `src/app/api/scores/route.ts`
- `src/app/api/passages/[id]/ghosts/route.ts`
- `src/hooks/useRace.ts`
- `src/hooks/useTyping.ts`
- `src/hooks/useMultiplayerRace.ts`
- `src/components/typing/typing-engine.ts`
- `src/components/race/race-renderer.ts`
- `src/components/race/RaceCanvas.tsx`
- `src/components/lobby/LobbyRace.tsx`
- `prisma/seed.ts`
- `tests/api/scores.test.ts`
- `tests/api/ghosts.test.ts`
- `tests/lib/score-validator.test.ts`
- `tests/hooks/useGhosts.test.ts`
- `tests/hooks/useMultiplayerRace.test.ts`
- `tests/components/typing-engine.test.ts`

- [ ] **Step 1: Update the shared TS types**

In `src/types/index.ts`, find the `ScoreSubmission` (and any related) type. Rename `ghostData` to `clientGhostData`.

- [ ] **Step 2: Update `src/lib/score-validator.ts`**

Wherever the validator accepts `ghostData`, rename to `clientGhostData` (or accept under both names temporarily — pick one and keep it consistent). The math is unchanged.

- [ ] **Step 3: Update `/api/scores` route**

In `src/app/api/scores/route.ts`, change the body destructure and the Prisma create:

```ts
const { passageId, clientGhostData, totalKeystrokes, correctKeystrokes } = body;
// ...
const sampledClientGhostData = sampleGhostData(clientGhostData as GhostDataPoint[]);

const score = await prisma.score.create({
  data: {
    userId: user.id,
    passageId,
    wpm: validation.wpm,
    accuracy: validation.accuracy,
    clientGhostData: sampledClientGhostData as unknown as import("@prisma/client").Prisma.InputJsonValue,
    flagged: false,
  },
});
```

- [ ] **Step 4: Update `/api/passages/[id]/ghosts` route**

This route reads `Score.ghostData` for replay. Change reads to `Score.clientGhostData`.

- [ ] **Step 5: Update client hooks and components**

For each of `src/hooks/useRace.ts`, `useTyping.ts`, `useMultiplayerRace.ts`, `src/components/typing/typing-engine.ts`, `src/components/race/race-renderer.ts`, `RaceCanvas.tsx`, `lobby/LobbyRace.tsx`: rename local references and POST/emit field names from `ghostData` to `clientGhostData`. Solo-mode submission body now uses `{ ..., clientGhostData: [...] }`.

For the multiplayer `player-finished` socket emit, **keep emitting under the old key `ghostData`** (the wire protocol parameter to Socket.IO), because the server's handler signature `socket.on("player-finished", ({ ghostData, ... }))` still names the parameter `ghostData`. The DB and the local TS field name are renamed; the wire field name stays — explicitly noted to avoid confusion.

- [ ] **Step 6: Update `prisma/seed.ts`**

Replace any `ghostData:` field in seed writes with `clientGhostData:`.

- [ ] **Step 7: Update tests**

Same rename in each test file. Run the relevant test files and fix any breakage:

```bash
npx vitest run tests/api tests/lib tests/hooks tests/components
```

Expected: all PASS.

- [ ] **Step 8: Run full frontend typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Run full server typecheck**

Run: `cd server && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/ tests/ prisma/seed.ts
git commit -m "refactor: rename ghostData→clientGhostData across frontend & solo API"
```

---

## Task 9: End-to-end integration test — server-authority anti-cheat contract

A single integration test that exercises the full Socket.IO path and proves the headline contract: **the server-derived WPM ignores client-supplied timing data.**

**Files:**
- Create: `server/tests/integration/server-authority.test.ts`

- [ ] **Step 1: Write the test**

Create `server/tests/integration/server-authority.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startTestServer, makeTestClient, TestServerHandle } from "./helpers"; // see existing room-lifecycle.test.ts for the pattern

describe("server-authority contract", () => {
  let server: TestServerHandle;
  beforeEach(async () => { server = await startTestServer(); });
  afterEach(async () => { await server.stop(); });

  it("final WPM reflects real wall-clock typing speed even when client sends fabricated ghostData", async () => {
    const alice = await makeTestClient(server, "alice");
    const bob = await makeTestClient(server, "bob");

    const roomCode = await alice.createRoom("medium");
    await bob.joinRoom(roomCode);
    await alice.startRace(roomCode);
    await alice.waitFor("race-started");

    // alice types at a real ~60 WPM pace: 5 chars/sec for 4 seconds → 20 chars
    for (let i = 1; i <= 20; i++) {
      alice.emit("typing-progress", { charIndex: i });
      await new Promise((r) => setTimeout(r, 200));
    }

    // alice cheats: claims it took 1 second (would be ~240 WPM if scoring trusted client)
    alice.emit("player-finished", {
      ghostData: [{ charIndex: 0, ms: 0 }, { charIndex: 20, ms: 1000 }],
      correctKeystrokes: 20,
      totalKeystrokes: 20,
    });

    const result = await alice.waitFor("player-finished-ack"); // or whatever event the handler emits; if none, query DB

    expect(result.wpm).toBeGreaterThan(50);
    expect(result.wpm).toBeLessThan(70);
  });
});
```

If `helpers.ts` and `makeTestClient` don't exist, build the smallest harness needed by reading `server/tests/integration/room-lifecycle.test.ts` and following its patterns.

- [ ] **Step 2: Run the test**

Run: `cd server && npx vitest run tests/integration/server-authority.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/tests/integration/
git commit -m "test(integration): server-authority contract — client ghostData is ignored for scoring"
```

---

## Task 10: README scope note

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a paragraph under the existing "Architecture" section**

Append after the architecture diagram in `README.md`:

```markdown
**Scoring authority:**

- **Multiplayer races** are *server-authoritative* — final WPM and accuracy are derived from server-stamped progress events received over WebSocket. Client-supplied keystroke timing data is preserved (`clientGhostData`) but used only for the existing solo-mode replay visualization.
- **Solo races** are *server-validated* but use client-supplied input (the typing happens entirely in-browser; only the final result is POSTed to `/api/scores`).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): clarify server-authoritative (multiplayer) vs server-validated (solo)"
```

---

## Task 11: Final integration smoke + tag

- [ ] **Step 1: Run all tests**

```bash
npx vitest run                       # frontend
cd server && npx vitest run          # server
npx playwright test                  # e2e (if dev DB up)
```

Expected: all PASS.

- [ ] **Step 2: Manual smoke**

```bash
# terminal 1
cd server && npm run dev
# terminal 2
npm run dev
```

Open two browser windows, sign in as two users, create a multiplayer room, race. Confirm:
- Race completes; results show realistic WPM/accuracy.
- Database row in `match_players` has both `clientGhostData` and `serverGhost` populated, and `flagged = false`.

- [ ] **Step 3: Tag the phase**

```bash
git tag -a phase-1-server-authoritative -m "Phase 1 complete: multiplayer scoring is server-authoritative"
```

---

## Spec coverage check

Cross-checking each Phase 1 requirement from the spec against tasks above:

- ✅ § 2.0 stamp `serverReceivedAt` on every `progress_update` → Task 2
- ✅ § 2.0 `RaceController` builds `serverGhost` → Task 2
- ✅ § 2.0 WPM derived from `serverGhost` only → Task 4
- ✅ § 2.0 client `ghostData` preserved for replay → Tasks 4, 5, 7
- ✅ § 2.6 `Score.flagged` field → Task 6
- ✅ § 2.6 `Score.serverGhost` JSONB → Task 6
- ✅ § 2.6 `Score.clientGhostData` (renamed from `ghostData`) → Task 6
- ✅ § 2.6 same on `MatchPlayer` → Task 6
- ✅ § 4.1 resume bullet wording supported by Task 9 integration test
- ✅ § 1 outcome #2: a defensible technical story → Task 9 is the demonstrable proof

Out of Phase 1 scope (covered in later phases):
- § 2.6 `Match.epochs` (Phase 2 — reconnection)
- `serverGhost` retention/null-on-unflagged logic (Phase 4 — anti-cheat ships the prune script)
- Client-side interpolation, clock-sync (Phase 2)

---

## Notes for the implementer

- **Tests-first discipline**: the order is always failing-test → run-and-see-fail → minimal-implementation → run-and-see-pass → commit. Don't batch.
- **Wire field name vs DB field name**: the Socket.IO `player-finished` event still carries the parameter under the wire name `ghostData` after this phase. The DB column and TypeScript types are renamed. This is intentional — renaming the wire protocol would cascade into client compatibility concerns out of Phase 1 scope. Phase 2 or later may revisit.
- **Two Prisma schemas**: keep `prisma/schema.prisma` and `server/prisma/schema.prisma` in lockstep. The migration is generated from the root one and applied to a single shared DB; the server schema is for type-generation only.
- **`performance.now()` vs `Date.now()`**: server-side `performance.now()` is monotonic and sub-ms. Use it for `serverMs` deltas. Don't substitute `Date.now()` — interval math will be skewed by NTP corrections.
