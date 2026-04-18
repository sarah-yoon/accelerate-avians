import type { Socket } from "socket.io";

export function emitWithServerTime<T extends object>(
  socket: Socket | { emit: (...args: unknown[]) => void },
  eventName: string,
  payload: T
): void {
  (socket as any).emit(eventName, { ...payload, serverTime: performance.now() });
}
