import { calculateResults } from "../lib/score-calculator.js";
import type { Room, RaceRanking, ServerGhostPoint } from "../types.js";

const COUNTDOWN_MS = 3000;

interface PassageInfo {
  id: string;
  text: string;
  charCount: number;
  wordCount: number;
}

interface FinishData {
  ghostData: Array<{ charIndex: number; ms: number }>;
  correctKeystrokes: number;
  totalKeystrokes: number;
}

interface PlayerFinishResult {
  placement: number;
  wpm: number;
  accuracy: number;
}

interface RaceState {
  passageCharCount: number;
  passageWordCount: number;
  playerCharIndices: Map<string, number>;
  serverGhost: Map<string, ServerGhostPoint[]>;     // NEW
  raceStartedAtPerfNow: number;                      // NEW — for serverMs deltas
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
  nextPlacement: number;
}

export class RaceController {
  private raceStates: Map<string, RaceState> = new Map();
  private onRaceTimeout: (roomCode: string) => void;

  constructor(onRaceTimeout: (roomCode: string) => void) {
    this.onRaceTimeout = onRaceTimeout;
  }

  destroy(): void {
    this.raceStates.clear();
  }

  startRace(room: Room, passage: PassageInfo): void {
    const connectedPlayers = Array.from(room.players.values()).filter(
      (p) => p.isConnected
    );
    if (connectedPlayers.length < 2) {
      throw new Error("Need at least 2 players to start");
    }

    room.status = "racing";
    room.passageId = passage.id;
    room.passageText = passage.text;
    room.passageCharCount = passage.charCount;
    room.raceStartedAt = Date.now();
    room.maxDurationMs = (passage.charCount / 2) * 1000 + 30000;

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

    // Set up race timeout (countdown + max race duration)
    const timeoutMs = COUNTDOWN_MS + room.maxDurationMs;
    room.raceTimeoutTimer = setTimeout(() => {
      this.onRaceTimeout(room.code);
    }, timeoutMs);
  }

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
      serverSamples,
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
      clientGhostData: data.ghostData,
      serverGhost: serverSamples.slice(),  // copy so post-finish updates don't mutate
    });

    return { placement, wpm, accuracy };
  }

  allPlayersFinished(roomCode: string): boolean {
    const state = this.raceStates.get(roomCode);
    if (!state) return false;
    return state.finishedPlayers.size >= state.playerCharIndices.size;
  }

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

  getServerGhost(roomCode: string, userId: string): ServerGhostPoint[] {
    const state = this.raceStates.get(roomCode);
    if (!state) return [];
    return state.serverGhost.get(userId) ?? [];
  }

  getProgressSnapshot(
    roomCode: string
  ): Array<{ userId: string; progress: number }> {
    const state = this.raceStates.get(roomCode);
    if (!state) return [];

    const snapshot: Array<{ userId: string; progress: number }> = [];
    for (const [userId, charIndex] of state.playerCharIndices) {
      snapshot.push({
        userId,
        progress: state.passageCharCount > 0 ? charIndex / state.passageCharCount : 0,
      });
    }
    return snapshot;
  }

  getRankings(roomCode: string, room: Room): RaceRanking[] {
    const state = this.raceStates.get(roomCode);
    if (!state) return [];

    const rankings: RaceRanking[] = [];

    // Add finished players first, sorted by placement
    const finished = Array.from(state.finishedPlayers.entries()).sort(
      ([, a], [, b]) => a.placement - b.placement
    );

    for (const [userId, data] of finished) {
      const player = room.players.get(userId);
      rankings.push({
        userId,
        username: player?.username ?? "Unknown",
        displayBird: player?.displayBird ?? "robin",
        wpm: data.wpm,
        accuracy: data.accuracy,
        placement: data.placement,
        status: "finished",
      });
    }

    // Add unfinished players as DNF
    let dnfPlacement = state.nextPlacement;
    for (const [userId] of state.playerCharIndices) {
      if (!state.finishedPlayers.has(userId)) {
        const player = room.players.get(userId);
        rankings.push({
          userId,
          username: player?.username ?? "Unknown",
          displayBird: player?.displayBird ?? "robin",
          wpm: null,
          accuracy: null,
          placement: dnfPlacement,
          status: "dnf",
        });
        dnfPlacement++;
      }
    }

    return rankings;
  }

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

  cleanupRace(roomCode: string): void {
    this.raceStates.delete(roomCode);
  }
}
