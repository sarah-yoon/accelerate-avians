import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RoomManager } from "../../src/rooms/room-manager.js";
import { RaceController } from "../../src/race/race-controller.js";

// Passage where wordCount drives WPM calculation.
// 20 words, 100 chars — easy math: typing all 100 chars = 20 words.
// At ~60 WPM: 20 words / 60 WPM * 60000 ms = 20000 ms elapsed.
const PASSAGE = {
  id: "auth-test-passage",
  text: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty",
  charCount: 131,
  wordCount: 20,
};

describe("server-authority contract", () => {
  let roomManager: RoomManager;
  let raceController: RaceController;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"],
    });
    roomManager = new RoomManager();
    raceController = new RaceController((_roomCode) => {});
  });

  afterEach(() => {
    raceController.destroy();
    roomManager.destroy();
    vi.useRealTimers();
  });

  it(
    "final WPM reflects server wall-clock speed even when client ghostData claims fabricated timing",
    () => {
      // --- Setup: two-player room ---
      const room = roomManager.createRoom("alice-id", "Alice", "robin", "socket-alice", "medium");
      roomManager.joinRoom(room.code, "bob-id", "Bob", "eagle", "socket-bob");
      raceController.startRace(room, PASSAGE);

      // --- Simulate Alice typing at ~60 WPM via server-side timer advancement ---
      // Target: 20 words in ~20 000 ms → 60 WPM.
      // We emit 20 progress events spread across 20 000 ms (1 000 ms apart).
      const charStep = Math.floor(PASSAGE.charCount / 20); // ~6 chars per step
      for (let step = 1; step <= 20; step++) {
        const charIndex = step === 20 ? PASSAGE.charCount : step * charStep;
        vi.advanceTimersByTime(1000); // advance server clock 1 second
        raceController.updateCharIndex(room.code, "alice-id", charIndex);
      }

      // --- Alice "cheats": claims she finished in 1 second (would be ~1200 WPM) ---
      const fabricatedGhostData = [
        { charIndex: 0, ms: 0 },
        { charIndex: PASSAGE.charCount, ms: 1000 }, // 1 second — wildly fast
      ];

      const result = raceController.playerFinished(room.code, "alice-id", {
        ghostData: fabricatedGhostData,
        correctKeystrokes: PASSAGE.charCount,
        totalKeystrokes: PASSAGE.charCount,
      });

      expect(result).not.toBeNull();

      // Server derived WPM from its own timestamps (~20 000 ms for 20 words ≈ 60 WPM).
      // If client ghostData were trusted, WPM would be ~1200 (20 words / 1 s).
      // We assert the result is in the ~60 WPM range, not anywhere near 1200.
      expect(result!.wpm).toBeGreaterThan(50);
      expect(result!.wpm).toBeLessThan(75);
    }
  );

  it("WPM is zero / null when no server progress events were recorded before finish", () => {
    // Verifies that there is no fallback to client ghostData for WPM computation.
    const room = roomManager.createRoom("alice-id", "Alice", "robin", "socket-alice", "medium");
    roomManager.joinRoom(room.code, "bob-id", "Bob", "eagle", "socket-bob");
    raceController.startRace(room, PASSAGE);

    // Alice sends player-finished with rich ghostData but zero server-side progress events.
    const fabricatedGhostData = [
      { charIndex: 0, ms: 0 },
      { charIndex: PASSAGE.charCount, ms: 5000 }, // claims 5 seconds / 240 WPM
    ];

    const result = raceController.playerFinished(room.code, "alice-id", {
      ghostData: fabricatedGhostData,
      correctKeystrokes: PASSAGE.charCount,
      totalKeystrokes: PASSAGE.charCount,
    });

    expect(result).not.toBeNull();
    // No server samples → calculateResults returns wpm = 0 (elapsedMs = 0).
    expect(result!.wpm).toBe(0);
  });
});
