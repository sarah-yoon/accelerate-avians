// Simple in-memory rate limiter using sliding window
const hits = new Map<string, number[]>();

// Clean old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of hits) {
    const filtered = timestamps.filter((t) => now - t < 120_000);
    if (filtered.length === 0) hits.delete(key);
    else hits.set(key, filtered);
  }
}, 300_000);

export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = hits.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxRequests) {
    return false; // rate limited
  }

  recent.push(now);
  hits.set(key, recent);
  return true; // allowed
}
