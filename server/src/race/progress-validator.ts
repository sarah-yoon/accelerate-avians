const MAX_UPDATES_PER_SECOND = 30;

interface PlayerState {
  lastCharIndex: number;
  updateCount: number;
  windowStart: number;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export class ProgressValidator {
  private passageLength: number;
  private playerStates: Map<string, PlayerState> = new Map();

  constructor(passageLength: number) {
    this.passageLength = passageLength;
  }

  validate(userId: string, charIndex: number): ValidationResult {
    // Bounds check
    if (charIndex < 0 || charIndex > this.passageLength) {
      return { valid: false, reason: "charIndex exceeds passage length" };
    }

    let state = this.playerStates.get(userId);
    if (!state) {
      state = { lastCharIndex: 0, updateCount: 0, windowStart: Date.now() };
      this.playerStates.set(userId, state);
    }

    // Monotonic check
    if (charIndex <= state.lastCharIndex) {
      return { valid: false, reason: "charIndex must increase monotonically" };
    }

    // Rate limit check
    const now = Date.now();
    if (now - state.windowStart >= 1000) {
      // Reset window
      state.updateCount = 0;
      state.windowStart = now;
    }
    state.updateCount++;
    if (state.updateCount > MAX_UPDATES_PER_SECOND) {
      return { valid: false, reason: "Rate limit exceeded" };
    }

    state.lastCharIndex = charIndex;
    return { valid: true };
  }

  getCharIndex(userId: string): number {
    return this.playerStates.get(userId)?.lastCharIndex ?? 0;
  }

  reset(): void {
    this.playerStates.clear();
  }
}
