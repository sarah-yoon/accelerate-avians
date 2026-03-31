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
  ghostData: GhostDataPoint[];
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
  ghostData: GhostDataPoint[];
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
