import type { Server as HTTPServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { URL } from "node:url";

/**
 * Raw-WebSocket load-test endpoint. Gated behind process.env.LOADTEST_ENDPOINT === "1".
 *
 * Protocol (JSON per message):
 *   → { kind: "join-room", roomCode, userId }
 *   ← { kind: "joined-room", roomCode, userId }
 *   → { kind: "typing-progress", charIndex, sentAt }
 *   ← { kind: "player-progress", userId, charIndex, serverTime, sentAt } (broadcast to OTHER sockets in room)
 *   → { kind: "player-finished", charIndex }
 *   ← { kind: "race-complete-ack", userId }
 *
 * `sentAt` is the client's wall-clock time at send; server echoes it back so
 * peer receivers can compute end-to-end latency (assuming same-machine clock).
 *
 * This endpoint exercises the broadcast FANOUT path with minimal ceremony.
 * It does NOT go through Clerk auth, Socket.IO framing, or the real
 * RoomManager — the goal is to measure broadcast latency scaling with
 * room count, not to re-test the Socket.IO stack.
 *
 * NEVER enable in production. If LOADTEST_ENDPOINT is set in a prod env,
 * anyone can create unlimited WS connections and broadcast to each other.
 */
export function attachLoadtestEndpoint(httpServer: HTTPServer): void {
  if (process.env.LOADTEST_ENDPOINT !== "1") return;

  console.warn("⚠️  LOADTEST_ENDPOINT=1 — /loadtest WebSocket is accepting connections.");
  console.warn("⚠️  This endpoint bypasses auth. Never enable in production.");

  const wss = new WebSocketServer({ noServer: true });

  // Per-room set of connected sockets.
  const rooms = new Map<string, Set<WebSocket>>();
  // Reverse index: ws → { roomCode, userId }
  const ownerOf = new WeakMap<WebSocket, { roomCode: string; userId: string }>();

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", "http://x");
    if (url.pathname !== "/loadtest") return;
    wss.handleUpgrade(req, socket as never, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return; // ignore malformed frames
      }
      const kind = msg.kind;

      if (kind === "join-room") {
        const roomCode = String(msg.roomCode);
        const userId = String(msg.userId);
        let set = rooms.get(roomCode);
        if (!set) {
          set = new Set();
          rooms.set(roomCode, set);
        }
        set.add(ws);
        ownerOf.set(ws, { roomCode, userId });
        ws.send(JSON.stringify({ kind: "joined-room", roomCode, userId }));
        return;
      }

      const owner = ownerOf.get(ws);
      if (!owner) return;

      if (kind === "typing-progress") {
        const charIndex = Number(msg.charIndex);
        if (!Number.isFinite(charIndex)) return;
        const sentAt = Number(msg.sentAt);
        const serverTime = performance.now();
        const payload = JSON.stringify({
          kind: "player-progress",
          userId: owner.userId,
          charIndex,
          serverTime,
          sentAt: Number.isFinite(sentAt) ? sentAt : null,
        });
        const set = rooms.get(owner.roomCode);
        if (!set) return;
        for (const peer of set) {
          if (peer === ws) continue;
          if (peer.readyState === peer.OPEN) peer.send(payload);
        }
        return;
      }

      if (kind === "player-finished") {
        ws.send(JSON.stringify({ kind: "race-complete-ack", userId: owner.userId }));
        return;
      }
    });

    ws.on("close", () => {
      const owner = ownerOf.get(ws);
      if (!owner) return;
      const set = rooms.get(owner.roomCode);
      if (!set) return;
      set.delete(ws);
      if (set.size === 0) rooms.delete(owner.roomCode);
    });
  });
}
