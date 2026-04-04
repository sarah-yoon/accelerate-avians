import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import { createClerkAuthMiddleware } from "./middleware/clerk-auth.js";
import { RoomManager } from "./rooms/room-manager.js";
import { RaceController } from "./race/race-controller.js";
import { registerRoomHandlers } from "./handlers/room-handlers.js";
import { registerRaceHandlers, finishRace } from "./handlers/race-handlers.js";
import { handleDisconnect } from "./handlers/connection-handler.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./types.js";

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
  pingInterval: 25000,
  pingTimeout: 60000,
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

  // Register all event handlers
  registerRoomHandlers(io, socket, roomManager);
  registerRaceHandlers(io, socket, roomManager, raceController);

  socket.on("disconnect", (reason) => {
    console.log(`Disconnected: ${socket.id} (reason: ${reason})`);
    handleDisconnect(io, socket, roomManager, raceController);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Accelerate Avians socket server running on port ${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
});
