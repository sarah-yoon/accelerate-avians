import crypto from "node:crypto";

// Bird names for room codes (spec format: "ROBIN-42")
const BIRD_NAMES = [
  "ROBIN", "FINCH", "CRANE", "EAGLE", "SWIFT",
  "HERON", "QUAIL", "RAVEN", "WREN", "STORK",
  "DUCKY", "OWLET", "GREBE", "IBIS", "SHRIKE",
  "VIREO", "PIPIT", "MACAW", "GROUSE", "EGRET",
];

export function generateRoomCode(): string {
  const bytes = crypto.randomBytes(2);
  const bird = BIRD_NAMES[bytes[0] % BIRD_NAMES.length];
  const num = (bytes[1] % 90) + 10; // 10-99
  return `${bird}-${num}`;
}
