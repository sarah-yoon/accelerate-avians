export type Difficulty = "short" | "medium" | "long";

export interface Passage {
  id: string;
  text: string;
  source: string;
  wordCount: number;
  charCount: number;
  difficulty: Difficulty;
}

export interface GhostDataPoint {
  charIndex: number;
  ms: number;
}

export interface GhostRacer {
  id: string;
  username: string;
  displayBird: string;
  wpm: number;
  clientGhostData: GhostDataPoint[];
  isPersonalBest?: boolean;
}

export interface RaceResult {
  wpm: number;
  accuracy: number;
  placement: number;
  totalRacers: number;
  isPersonalBest: boolean;
}

export interface ScoreSubmission {
  passageId: string;
  clientGhostData: GhostDataPoint[];
  totalKeystrokes: number;
  correctKeystrokes: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayBird: string;
  wpm: number;
  accuracy: number;
  createdAt: string;
}

export interface ProfileStats {
  userId: string;
  username: string;
  displayBird: string;
  avgWpm: number;
  avgAccuracy: number;
  bestWpm: number;
  bestAccuracy: number;
  totalRaces: number;
  recentRaces: {
    passageId: string;
    wpm: number;
    accuracy: number;
    createdAt: string;
  }[];
}

export type RacePhase = "idle" | "countdown" | "racing" | "finished";

// --- Multiplayer Types ---

export type RoomStatus = "waiting" | "racing" | "completed" | "expired";

export interface MultiplayerPlayer {
  userId: string;
  username: string;
  displayBird: string;
  isHost: boolean;
  isConnected: boolean;
}

export interface RoomState {
  code: string;
  status: RoomStatus;
  hostUserId: string;
  yourUserId?: string;
  difficulty: Difficulty;
  players: MultiplayerPlayer[];
  passage?: {
    id: string;
    text: string;
    charCount: number;
    wordCount: number;
  };
  raceStartedAt?: number;
  yourCharIndex?: number;
}

export interface MultiplayerRanking {
  userId: string;
  username: string;
  displayBird: string;
  wpm: number | null;
  accuracy: number | null;
  placement: number;
  status: "finished" | "dnf";
}
