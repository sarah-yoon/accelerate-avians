import type { Socket } from "socket.io";

export function emitWithServerTime<T extends object>(
  socket: Socket | { emit: (...args: unknown[]) => void },
  eventName: string,
  payload: T
): void {
  (socket as any).emit(eventName, { ...payload, serverTime: performance.now() });
}

export class TimeSyncTracker {
  private seen = new Set<string>();
  allow(socketId: string): boolean {
    if (this.seen.has(socketId)) return false;
    this.seen.add(socketId);
    return true;
  }
  release(socketId: string): void {
    this.seen.delete(socketId);
  }
}
