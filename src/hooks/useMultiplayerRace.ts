"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import type {
  RoomState,
  MultiplayerPlayer,
  MultiplayerRanking,
  Difficulty,
} from "@/types";

type LobbyPhase = "waiting" | "countdown" | "racing" | "results";

interface PlayerProgressMap {
  [userId: string]: number; // 0 to 1
}

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
  createRoom: (difficulty: Difficulty) => void;
  joinRoom: (roomCode: string) => void;
  startRace: () => void;
  sendProgress: (charIndex: number) => void;
  sendFinished: (ghostData: Array<{ charIndex: number; ms: number }>, correctKeystrokes: number, totalKeystrokes: number) => void;
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

  useEffect(() => {
    if (!socket) return;

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

      if (state.passage) {
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
    }

    function onPlayerReconnected({ userId }: { userId: string }) {
      setPlayers((prev) =>
        prev.map((p) =>
          p.userId === userId ? { ...p, isConnected: true } : p
        )
      );
    }

    function onRaceStarted(payload: {
      passage: { id: string; text: string; charCount: number; wordCount: number };
      countdownMs: number;
    }) {
      setPassage(payload.passage);
      setLobbyPhase("countdown");
      setCountdownValue(3);

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
      players: Array<{ userId: string; progress: number }>;
    }) {
      const newProgresses: PlayerProgressMap = {};
      for (const p of payload.players) {
        newProgresses[p.userId] = p.progress;
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

    socket.on("room-created", onRoomCreated);
    socket.on("room-state", onRoomState);
    socket.on("player-joined", onPlayerJoined);
    socket.on("player-left", onPlayerLeft);
    socket.on("player-reconnected", onPlayerReconnected);
    socket.on("race-started", onRaceStarted);
    socket.on("player-progress", onPlayerProgress);
    socket.on("race-results", onRaceResults);
    socket.on("race-timeout", onRaceTimeout);
    socket.on("room-error", onRoomError);

    return () => {
      socket.off("room-created", onRoomCreated);
      socket.off("room-state", onRoomState);
      socket.off("player-joined", onPlayerJoined);
      socket.off("player-left", onPlayerLeft);
      socket.off("player-reconnected", onPlayerReconnected);
      socket.off("race-started", onRaceStarted);
      socket.off("player-progress", onPlayerProgress);
      socket.off("race-results", onRaceResults);
      socket.off("race-timeout", onRaceTimeout);
      socket.off("room-error", onRoomError);

      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [socket]);

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
    (ghostData: Array<{ charIndex: number; ms: number }>, correctKeystrokes: number, totalKeystrokes: number) => {
      if (!socket) return;
      socket.emit("player-finished", { ghostData, correctKeystrokes, totalKeystrokes });
    },
    [socket]
  );

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
    createRoom,
    joinRoom,
    startRace,
    sendProgress,
    sendFinished,
  };
}
