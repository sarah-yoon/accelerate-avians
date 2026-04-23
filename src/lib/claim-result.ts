/**
 * Spec § 3.7 — guest-to-account claim stash. Anonymous race results are
 * written to localStorage so that if the user signs up within 30 minutes,
 * the next authenticated page load can POST them to /api/scores. FIFO,
 * cap 3. Entries older than 30 minutes are dropped at read time.
 */

const KEY = "aa.pending-claim";
const MAX = 3;
export const RECENCY_MS = 30 * 60 * 1000;

export interface PendingClaim {
  passageId: string;
  clientGhostData: Array<{ charIndex: number; ms: number }>;
  totalKeystrokes: number;
  correctKeystrokes: number;
  completedAt: number;
}

function read(): PendingClaim[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PendingClaim[];
  } catch {
    return [];
  }
}

function write(list: PendingClaim[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function stashResult(claim: PendingClaim): void {
  const list = read();
  list.push(claim);
  while (list.length > MAX) list.shift(); // drop oldest
  write(list);
}

/** Returns entries with completedAt within the recency window; silently drops older. */
export function readRecentClaims(nowMs: number = Date.now()): PendingClaim[] {
  const list = read();
  const recent = list.filter((c) => nowMs - c.completedAt <= RECENCY_MS);
  if (recent.length !== list.length) write(recent);
  return recent;
}

export function clearClaims(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
