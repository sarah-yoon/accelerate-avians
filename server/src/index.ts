import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import { createClerkAuthMiddleware } from "./middleware/clerk-auth.js";
import { RoomManager } from "./rooms/room-manager.js";
import { RaceController } from "./race/race-controller.js";
import { registerRoomHandlers } from "./handlers/room-handlers.js";
import { registerRaceHandlers, finishRace } from "./handlers/race-handlers.js";
import {
  handleDisconnect,
  handleNewReconnect,
  registerSocket,
  unregisterSocket,
  defaultSessionStore,
  SlowConsumerSampler,
} from "./handlers/connection-handler.js";
import { readSecretFromEnv } from "./lib/resume-token.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./types.js";

// Validate required secrets before binding port.
const RESUME_TOKEN_SECRET = readSecretFromEnv();
void RESUME_TOKEN_SECRET;

const PORT = parseInt(process.env.PORT || "3001", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY;

if (!CLERK_SECRET_KEY) {
  console.error("CLERK_SECRET_KEY is required");
  process.exit(1);
}
if (!CLERK_PUBLISHABLE_KEY) {
  console.error("CLERK_PUBLISHABLE_KEY is required");
  process.exit(1);
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));

// Health check endpoint for Railway
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

const httpServer = createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
  transports: ['websocket'],
  pingInterval: 5_000,
  pingTimeout: 8_000,
  perMessageDeflate: false,
  maxHttpBufferSize: 16_384,
  connectionStateRecovery: {
    maxDisconnectionDuration: 30_000,
  },
});

// Shared state
const roomManager = new RoomManager();

const raceController = new RaceController((roomCode) => {
  // Race timeout callback
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  finishRace(io, roomCode, room, roomManager, raceController, true).catch((err) => {
    console.error(`Error finishing timed-out race ${roomCode}:`, err);
  });
});

// Auth middleware
io.use(createClerkAuthMiddleware(CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY));

// Connection handler
io.on("connection", (socket) => {
  console.log(`Connected: ${socket.id} (user: ${socket.data.userId})`);

  // CRITICAL 3: Register socket so handleNewReconnect can fence old sockets.
  registerSocket(socket);

  // Register all event handlers
  registerRoomHandlers(io, socket, roomManager);
  registerRaceHandlers(io, socket, roomManager, raceController);

  // Spec § 2.4: Sample each socket's outgoing buffer every 2 s; disconnect
  // slow consumers that exceed 64 KB for two consecutive samples.
  const slowConsumerSampler = new SlowConsumerSampler(socket);
  const slowConsumerInterval = setInterval(() => slowConsumerSampler.sample(), 2000);

  // CRITICAL 1: Wire the token-based reconnect protocol (Spec § 2.3 step 6).
  socket.on("reconnect", async ({ token }) => {
    await handleNewReconnect(
      io,
      socket,
      roomManager,
      raceController,
      RESUME_TOKEN_SECRET,
      token,
      /* socketRegistry */ undefined,  // uses defaultSocketRegistry
      defaultSessionStore,
    );
  });

  socket.on("disconnect", (reason) => {
    console.log(`Disconnected: ${socket.id} (reason: ${reason})`);
    // Clean up the slow-consumer sampling interval.
    clearInterval(slowConsumerInterval);
    // CRITICAL 3: Unregister socket on disconnect to keep registry clean.
    unregisterSocket(socket.id);
    handleDisconnect(io, socket, roomManager, raceController);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Accelerate Avians socket server running on port ${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
});
