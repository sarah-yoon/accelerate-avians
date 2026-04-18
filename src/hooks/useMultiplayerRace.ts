"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import type {
  RoomState,
  MultiplayerPlayer,
  MultiplayerRanking,
  Difficulty,
  PlayerProgressEntry,
  ResumeStatePayload,
} from "@/types";
import { ClockSync } from "@/lib/clock-sync";
import type { Sample } from "@/hooks/useInterpolatedProgress";

type LobbyPhase = "waiting" | "countdown" | "racing" | "results";

interface PlayerProgressMap {
  [userId: string]: number; // 0 to 1
}

/** Maximum samples to keep per opponent (3 s at 10 Hz). */
const MAX_SAMPLES = 30;

/** Number of time-sync pings to send on connect. */
const HANDSHAKE_PING_COUNT = 5;

/** Interval between pings (ms). */
const HANDSHAKE_PING_INTERVAL_MS = 200;

interface UseMultiplayerRaceReturn {
  roomCode: string | null;
  lobbyPhase: LobbyPhase;
  players: MultiplayerPlayer[];
  hostUserId: string | null;
  isHost: boolean;
  difficulty: Difficulty;
  passage: { id: string; text: string; charCount: number; wordCount: number } | null;
  countdownValue: number | "GO";
  playerProgresses: PlayerProgressMap;
  rankings: MultiplayerRanking[] | null;
  raceStartedAt: number | null;
  reconnectCharIndex: number | null;
  myUserId: string | null;
  connectionError: string | null;
  /** Per-opponent sample buffer for interpolated rendering (P2-12). */
  samplesRef: React.RefObject<Map<string, Sample[]>>;
  /** Returns true once ClockSync has >= 5 handshake samples. */
  clockSyncIsReady: () => boolean;
  /** Converts client performance.now() to adjusted server time. */
  toServerTime: (clientMs: number) => number;
  createRoom: (difficulty: Difficulty) => void;
  joinRoom: (roomCode: string) => void;
  startRace: () => void;
  sendProgress: (charIndex: number) => void;
  sendFinished: (clientGhostData: Array<{ charIndex: number; ms: number }>, correctKeystrokes: number, totalKeystrokes: number) => void;
  playAgain: () => void;
  leaveLobby: () => void;
  changeDifficulty: (difficulty: Difficulty) => void;
}

export function useMultiplayerRace(
  socket: Socket | null
): UseMultiplayerRaceReturn {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [lobbyPhase, setLobbyPhase] = useState<LobbyPhase>("waiting");
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
  const [hostUserId, setHostUserId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [passage, setPassage] = useState<UseMultiplayerRaceReturn["passage"]>(null);
  const [countdownValue, setCountdownValue] = useState<number | "GO">(3);
  const [playerProgresses, setPlayerProgresses] = useState<PlayerProgressMap>({});
  const [rankings, setRankings] = useState<MultiplayerRanking[] | null>(null);
  const [raceStartedAt, setRaceStartedAt] = useState<number | null>(null);
  const [reconnectCharIndex, setReconnectCharIndex] = useState<number | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Clock sync & sample buffering refs (stable across renders) ---

  /** One ClockSync instance per hook mount (per race session). */
  const clockSyncRef = useRef<ClockSync>(new ClockSync());

  /** Per-opponent sample buffer, keyed by userId. */
  const samplesRef = useRef<Map<string, Sample[]>>(new Map());

  /** Stashed resume token issued by the server; sent back on reconnect. */
  const resumeTokenRef = useRef<string | null>(null);

  /** Whether we are currently inside the racing phase (used by disconnect handler). */
  const isRacingRef = useRef(false);

  // Keep isRacingRef in sync with lobbyPhase without a closure capture problem.
  useEffect(() => {
    isRacingRef.current = lobbyPhase === "racing";
  }, [lobbyPhase]);

  // Stable callbacks so the event effect doesn't re-run when these change.
  const clockSyncIsReady = useCallback(() => clockSyncRef.current.isReady(), []);
  const toServerTime = useCallback(
    (clientMs: number) => clockSyncRef.current.toServerTime(clientMs),
    []
  );

  // --- Clock-sync handshake ---

  /**
   * Send 5 time-sync pings ~200 ms apart right after the socket connects.
   * Each pong is recorded by ClockSync so it can compute the clock offset.
   */
  const startHandshake = useCallback(
    (sock: Socket) => {
      let sent = 0;
      const interval = setInterval(() => {
        if (sent >= HANDSHAKE_PING_COUNT) {
          clearInterval(interval);
          return;
        }
        const clientSendTime = performance.now();
        sock.emit("time-sync-ping", { clientSendTime });
        sent++;
      }, HANDSHAKE_PING_INTERVAL_MS);
    },
    []
  );

  // --- Main socket event effect ---

  useEffect(() => {
    if (!socket) return;
    // Capture the narrowed non-null reference so inner closures can use it safely.
    const sock = socket;

    // Start the handshake immediately on (re)connect.
    startHandshake(sock);

    function onTimeSyncPong(payload: { clientSendTime: number; serverTime: number }) {
      clockSyncRef.current.recordHandshake({
        clientSendTime: payload.clientSendTime,
        clientReceiveTime: performance.now(),
        serverTime: payload.serverTime,
      });
    }

    function onRoomCreated({ roomCode }: { roomCode: string }) {
      setRoomCode(roomCode);
      setLobbyPhase("waiting");
    }

    function onRoomState(state: RoomState) {
      setRoomCode(state.code);
      setPlayers(state.players);
      setHostUserId(state.hostUserId);
      if (state.yourUserId) {
        setMyUserId(state.yourUserId);
      }
      setDifficulty(state.difficulty);

      if (state.status === "waiting") {
        setLobbyPhase("waiting");
        setPassage(null);
        setRankings(null);
        setPlayerProgresses({});
        setRaceStartedAt(null);
      } else if (state.passage) {
        setPassage(state.passage);
      }
      if (state.raceStartedAt) {
        setRaceStartedAt(state.raceStartedAt);
        setLobbyPhase("racing");
      }
      if (state.yourCharIndex !== undefined) {
        setReconnectCharIndex(state.yourCharIndex);
      }
    }

    function onPlayerJoined(payload: {
      userId: string;
      username: string;
      displayBird: string;
    }) {
      setPlayers((prev) => {
        if (prev.some((p) => p.userId === payload.userId)) return prev;
        return [
          ...prev,
          { ...payload, isHost: false, isConnected: true },
        ];
      });
    }

    function onPlayerLeft({ userId }: { userId: string }) {
      setPlayers((prev) => prev.filter((p) => p.userId !== userId));
      // Clean up sample buffer for departed player.
      samplesRef.current.delete(userId);
    }

    /** CRITICAL (P2-12): flip isConnected = false so the "..." bubble fires. */
    function onPlayerDisconnected({ userId }: { userId: string }) {
      setPlayers((prev) =>
        prev.map((p) =>
          p.userId === userId ? { ...p, isConnected: false } : p
        )
      );
    }

    function onPlayerReconnected({ userId }: { userId: string }) {
      setPlayers((prev) =>
        prev.map((p) =>
          p.userId === userId ? { ...p, isConnected: true } : p
        )
      );
    }

    /** Player dropped (DNF) after the 20 s reconnect window expired. */
    function onPlayerDropped({ userId }: { userId: string }) {
      setPlayers((prev) => prev.filter((p) => p.userId !== userId));
      samplesRef.current.delete(userId);
    }

    function onRaceStarted(payload: {
      passage: { id: string; text: string; charCount: number; wordCount: number };
      countdownMs: number;
    }) {
      setPassage(payload.passage);
      setLobbyPhase("countdown");
      setCountdownValue(3);
      // Clear sample buffers for a fresh race.
      samplesRef.current.clear();

      let count = 3;
      countdownTimerRef.current = setInterval(() => {
        count--;
        if (count > 0) {
          setCountdownValue(count);
        } else if (count === 0) {
          setCountdownValue("GO");
        } else {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          setLobbyPhase("racing");
          setRaceStartedAt(performance.now());
        }
      }, 1000);
    }

    function onPlayerProgress(payload: {
      players: Array<PlayerProgressEntry>;
    }) {
      const newProgresses: PlayerProgressMap = {};
      for (const p of payload.players) {
        newProgresses[p.userId] = p.progress;

        // Push into sample buffer for interpolation.
        if (!samplesRef.current.has(p.userId)) {
          samplesRef.current.set(p.userId, []);
        }
        const buf = samplesRef.current.get(p.userId)!;
        buf.push({ serverTime: p.serverTime, charIndex: p.charIndex });
        // Cap to MAX_SAMPLES (trim oldest entries).
        if (buf.length > MAX_SAMPLES) {
          buf.splice(0, buf.length - MAX_SAMPLES);
        }
      }
      setPlayerProgresses(newProgresses);
    }

    function onRaceResults(payload: { rankings: MultiplayerRanking[] }) {
      setRankings(payload.rankings);
      setLobbyPhase("results");
    }

    function onRaceTimeout(payload: { rankings: MultiplayerRanking[] }) {
      setRankings(payload.rankings);
      setLobbyPhase("results");
    }

    function onRoomError(payload: { message: string }) {
      setConnectionError(payload.message);
    }

    /** Server-issued resume token — stash for use on reconnect. */
    function onResumeToken(payload: { token: string }) {
      resumeTokenRef.current = payload.token;
    }

    /** Full race snapshot on reconnect — restore local state. */
    function onResumeState(payload: ResumeStatePayload) {
      // Stash the fresh token.
      resumeTokenRef.current = payload.token;
      // Restore our own charIndex.
      setReconnectCharIndex(payload.charIndex);
      // Restore isConnected flags for all players.
      setPlayers((prev) =>
        prev.map((p) => {
          const entry = payload.players.find((pp) => pp.userId === p.userId);
          return entry ? { ...p, isConnected: entry.isConnected } : p;
        })
      );
      // Seed opponent sample buffers with the current charIndex snapshot.
      // Server time is approximately now on the server — use our toServerTime
      // to set a baseline sample so interpolation has something to work from.
      const approxServerNow = clockSyncRef.current.toServerTime(performance.now());
      for (const entry of payload.players) {
        const buf: Sample[] = [{ serverTime: approxServerNow, charIndex: entry.charIndex }];
        samplesRef.current.set(entry.userId, buf);
      }
      // Re-run the clock handshake so offset stays fresh after the reconnect.
      startHandshake(sock);
    }

    /** Reconnect rejected by server — log for Phase 2, UI toast in Phase 5. */
    function onReconnectError(payload: { reason: string }) {
      console.warn("[useMultiplayerRace] reconnect-error:", payload.reason);
      setConnectionError(`Reconnect failed: ${payload.reason}`);
    }

    /** Socket-level disconnect — attempt token-based reconnect if racing. */
    function onSocketDisconnect(reason: string) {
      console.log("[useMultiplayerRace] socket disconnect:", reason);
      if (isRacingRef.current && resumeTokenRef.current) {
        // Socket.IO will auto-reconnect the transport; once it does, emit reconnect.
        sock.once("connect", () => {
          if (resumeTokenRef.current) {
            console.log("[useMultiplayerRace] emitting reconnect with token");
            sock.emit("reconnect", { token: resumeTokenRef.current });
            // Also re-run handshake on reconnect.
            startHandshake(sock);
          }
        });
      }
    }

    sock.on("time-sync-pong", onTimeSyncPong);
    sock.on("room-created", onRoomCreated);
    sock.on("room-state", onRoomState);
    sock.on("player-joined", onPlayerJoined);
    sock.on("player-left", onPlayerLeft);
    sock.on("player-disconnected", onPlayerDisconnected);
    sock.on("player-reconnected", onPlayerReconnected);
    sock.on("player-dropped", onPlayerDropped);
    sock.on("race-started", onRaceStarted);
    sock.on("player-progress", onPlayerProgress);
    sock.on("race-results", onRaceResults);
    sock.on("race-timeout", onRaceTimeout);
    sock.on("room-error", onRoomError);
    sock.on("resume-token", onResumeToken);
    sock.on("resume-state", onResumeState);
    sock.on("reconnect-error", onReconnectError);
    sock.on("disconnect", onSocketDisconnect);

    return () => {
      sock.off("time-sync-pong", onTimeSyncPong);
      sock.off("room-created", onRoomCreated);
      sock.off("room-state", onRoomState);
      sock.off("player-joined", onPlayerJoined);
      sock.off("player-left", onPlayerLeft);
      sock.off("player-disconnected", onPlayerDisconnected);
      sock.off("player-reconnected", onPlayerReconnected);
      sock.off("player-dropped", onPlayerDropped);
      sock.off("race-started", onRaceStarted);
      sock.off("player-progress", onPlayerProgress);
      sock.off("race-results", onRaceResults);
      sock.off("race-timeout", onRaceTimeout);
      sock.off("room-error", onRoomError);
      sock.off("resume-token", onResumeToken);
      sock.off("resume-state", onResumeState);
      sock.off("reconnect-error", onReconnectError);
      sock.off("disconnect", onSocketDisconnect);

      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [socket, startHandshake]);

  const createRoom = useCallback(
    (diff: Difficulty) => {
      if (!socket) return;
      setDifficulty(diff);
      socket.emit("create-room", { difficulty: diff });
    },
    [socket]
  );

  const joinRoom = useCallback(
    (code: string) => {
      if (!socket) return;
      socket.emit("join-room", { roomCode: code });
    },
    [socket]
  );

  const startRace = useCallback(() => {
    if (!socket || !roomCode) return;
    socket.emit("start-race", { roomCode });
  }, [socket, roomCode]);

  const sendProgress = useCallback(
    (charIndex: number) => {
      if (!socket) return;
      socket.emit("typing-progress", { charIndex });
    },
    [socket]
  );

  const sendFinished = useCallback(
    (clientGhostData: Array<{ charIndex: number; ms: number }>, correctKeystrokes: number, totalKeystrokes: number) => {
      if (!socket) return;
      // Wire protocol key stays "ghostData" — server handler expects that name
      socket.emit("player-finished", { ghostData: clientGhostData, correctKeystrokes, totalKeystrokes });
    },
    [socket]
  );

  const playAgain = useCallback(() => {
    if (!socket || !roomCode) return;
    // Reset local state for a new race
    setLobbyPhase("waiting");
    setPassage(null);
    setRankings(null);
    setPlayerProgresses({});
    setRaceStartedAt(null);
    setReconnectCharIndex(null);
    resumeTokenRef.current = null;
    samplesRef.current.clear();
    // Fresh ClockSync for the new session.
    clockSyncRef.current = new ClockSync();
    socket.emit("play-again", { roomCode });
  }, [socket, roomCode]);

  const changeDifficulty = useCallback(
    (diff: Difficulty) => {
      if (!socket || !roomCode) return;
      socket.emit("change-difficulty", { roomCode, difficulty: diff });
    },
    [socket, roomCode]
  );

  const leaveLobby = useCallback(() => {
    if (!socket || !roomCode) return;
    socket.emit("leave-room", { roomCode });
    setRoomCode(null);
    setLobbyPhase("waiting");
    setPlayers([]);
    setHostUserId(null);
    setPassage(null);
    setRankings(null);
    setConnectionError(null);
    resumeTokenRef.current = null;
    samplesRef.current.clear();
  }, [socket, roomCode]);

  return {
    roomCode,
    lobbyPhase,
    players,
    hostUserId,
    isHost: myUserId !== null && hostUserId === myUserId,
    myUserId,
    difficulty,
    passage,
    countdownValue,
    playerProgresses,
    rankings,
    raceStartedAt,
    reconnectCharIndex,
    connectionError,
    samplesRef,
    clockSyncIsReady,
    toServerTime,
    createRoom,
    joinRoom,
    startRace,
    sendProgress,
    sendFinished,
    playAgain,
    leaveLobby,
    changeDifficulty,
  };
}
