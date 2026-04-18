export interface RoomPlayer {
  userId: string;
  username: string;
  displayBird: string;
  socketId: string;
  isHost: boolean;
  isConnected: boolean;
  disconnectedAt: number | null;
}

export type RoomStatus = "waiting" | "racing" | "completed" | "expired";

export interface Room {
  code: string;
  status: RoomStatus;
  hostUserId: string;
  difficulty: "short" | "medium" | "long";
  players: Map<string, RoomPlayer>;
  passageId: string | null;
  passageText: string | null;
  passageCharCount: number | null;
  raceStartedAt: number | null;
  maxDurationMs: number | null;
  createdAt: number;
  lastActivityAt: number;
  raceTimeoutTimer: ReturnType<typeof setTimeout> | null;
  progressBroadcastInterval: ReturnType<typeof setInterval> | null;
}

export interface PlayerProgress {
  userId: string;
  charIndex: number;
  lastUpdateAt: number;
  updateCount: number;
  updateWindowStart: number;
  finished: boolean;
  clientGhostData: Array<{ charIndex: number; ms: number }>;
}

export interface RaceRanking {
  userId: string;
  username: string;
  displayBird: string;
  wpm: number | null;
  accuracy: number | null;
  placement: number;
  status: "finished" | "dnf";
}

// Socket.io event payloads
export interface ServerToClientEvents {
  "room-created": (payload: { roomCode: string }) => void;
  "player-joined": (payload: {
    userId: string;
    username: string;
    displayBird: string;
  }) => void;
  "player-left": (payload: { userId: string }) => void;
  "player-reconnected": (payload: { userId: string }) => void;
  "player-disconnected": (payload: { userId: string }) => void;
  "player-dropped": (payload: { userId: string }) => void;
  "race-started": (payload: {
    passage: { id: string; text: string; charCount: number; wordCount: number };
    countdownMs: number;
  }) => void;
  "player-progress": (payload: {
    players: Array<{ userId: string; progress: number }>;
  }) => void;
  "race-results": (payload: { rankings: RaceRanking[] }) => void;
  "race-timeout": (payload: { rankings: RaceRanking[] }) => void;
  "room-error": (payload: { message: string }) => void;
  "room-state": (payload: {
    code: string;
    status: RoomStatus;
    hostUserId: string;
    yourUserId?: string;
    difficulty: "short" | "medium" | "long";
    players: Array<{
      userId: string;
      username: string;
      displayBird: string;
      isHost: boolean;
      isConnected: boolean;
    }>;
    passage?: { id: string; text: string; charCount: number; wordCount: number };
    raceStartedAt?: number;
    yourCharIndex?: number;
  }) => void;
  /** Issued to a newly connected socket after auth + join. Client stores this. */
  "resume-token": (payload: { token: string }) => void;
  /** Sent to a reconnecting socket — full race state snapshot. */
  "resume-state": (payload: {
    token: string;
    charIndex: number;
    raceElapsedMs: number;
    comboCount: number;
    comboPaused: boolean;
    comboPausedAtCharIndex: number;
    players: Array<{ userId: string; charIndex: number; isConnected: boolean }>;
  }) => void;
  /** Emitted to the reconnecting socket on any rejection during the reconnect handshake. */
  "reconnect-error": (payload: { reason: string }) => void;
}

export interface ClientToServerEvents {
  "create-room": (payload: { difficulty: "short" | "medium" | "long" }) => void;
  "join-room": (payload: { roomCode: string }) => void;
  "start-race": (payload: { roomCode: string }) => void;
  "typing-progress": (payload: { charIndex: number }) => void;
  "player-finished": (payload: {
    ghostData: Array<{ charIndex: number; ms: number }>;
    correctKeystrokes: number;
    totalKeystrokes: number;
  }) => void;
  "leave-room": (payload: { roomCode: string }) => void;
  "play-again": (payload: { roomCode: string }) => void;
  "change-difficulty": (payload: { roomCode: string; difficulty: "short" | "medium" | "long" }) => void;
  /** Client emits this on reconnect with a stored resumeToken to resume a racing session. */
  "reconnect": (payload: { token: string }) => void;
}

export interface SocketData {
  userId: string;
  username: string;
  displayBird: string;
  roomCode: string | null;
}

export interface ServerGhostPoint {
  charIndex: number;
  serverMs: number;
}
