import { createHmac, timingSafeEqual } from "node:crypto";

/** Reconnect window: 20s after disconnect the client must submit their token. */
export const RESUME_WINDOW_MS = 20_000;
/**
 * Grace period added to RESUME_WINDOW_MS for clock skew / in-flight tokens.
 * Total token lifetime: 50s (20s window + 30s grace).
 * Note: spec prose historically said "45s" — the implementation has shipped at
 * 50s (GRACE_MS = 30_000) and consumers depend on that value.
 */
export const GRACE_MS = 30_000;

export interface ResumeTokenPayload {
  userId: string;
  roomCode: string;
  sessionEpoch: number;
  sessionId: string;
}

interface SignedPayload extends ResumeTokenPayload {
  issuedAt: number;
}

type VerifyResult =
  | { valid: true; payload: SignedPayload }
  | { valid: false; reason: string };

export function mintResumeToken(
  secret: string,
  payload: ResumeTokenPayload,
  issuedAt: number = Date.now()
): string {
  const body: SignedPayload = { ...payload, issuedAt };
  const json = JSON.stringify(body);
  const sig = createHmac("sha256", secret).update(json).digest("hex");
  return Buffer.from(json).toString("base64url") + "." + sig;
}

export function verifyResumeToken(secret: string, token: string): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, reason: "malformed" };
  const [b64, sig] = parts;
  let json: string;
  try {
    json = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return { valid: false, reason: "malformed" };
  }
  const expectedSig = createHmac("sha256", secret).update(json).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expectedSig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "bad-signature" };
  }
  let body: SignedPayload;
  try {
    body = JSON.parse(json);
  } catch {
    return { valid: false, reason: "malformed" };
  }
  if (Date.now() - body.issuedAt > RESUME_WINDOW_MS + GRACE_MS) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, payload: body };
}

export function readSecretFromEnv(): string {
  const v = process.env.RESUME_TOKEN_SECRET;
  if (!v || v.length < 32) {
    throw new Error(
      "RESUME_TOKEN_SECRET env var missing or shorter than 32 bytes. Generate with: openssl rand -hex 32"
    );
  }
  return v;
}
