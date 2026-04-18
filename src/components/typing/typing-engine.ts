import type { GhostDataPoint } from "@/types";

export class TypingEngine {
  private passage: string;
  private _cursorPos = 0;
  private _errors = 0;
  private _hasError = false;
  private _totalKeystrokes = 0;
  private _correctKeystrokes = 0;
  private _clientGhostData: GhostDataPoint[] = [];
  private _isComposing = false;

  constructor(passage: string) {
    this.passage = passage;
  }

  get cursorPos(): number {
    return this._cursorPos;
  }

  get errors(): number {
    return this._errors;
  }

  get hasError(): boolean {
    return this._hasError;
  }

  get isComplete(): boolean {
    return this._cursorPos >= this.passage.length;
  }

  get clientGhostData(): GhostDataPoint[] {
    return this._clientGhostData;
  }

  get totalKeystrokes(): number {
    return this._totalKeystrokes;
  }

  get correctKeystrokes(): number {
    return this._correctKeystrokes;
  }

  setComposing(composing: boolean): void {
    this._isComposing = composing;
  }

  handleKey(key: string, timestampMs: number): void {
    if (this._isComposing || this.isComplete) return;
    if (key.length !== 1) return;

    this._totalKeystrokes++;

    const expected = this.passage[this._cursorPos];
    if (key === expected) {
      this._clientGhostData.push({
        charIndex: this._cursorPos,
        ms: timestampMs,
      });
      this._cursorPos++;
      this._correctKeystrokes++;
      this._hasError = false;
    } else {
      this._errors++;
      this._hasError = true;
    }
  }

  getCurrentWpm(elapsedMs: number): number {
    if (elapsedMs <= 0 || this._cursorPos === 0) return 0;
    // Standard: 1 word = 5 characters
    const words = this._cursorPos / 5;
    return Math.round((words / elapsedMs) * 60000);
  }

  getAccuracy(): number {
    if (this._totalKeystrokes === 0) return 0;
    return this._correctKeystrokes / this._totalKeystrokes;
  }

  /**
   * Advance the cursor to a specific index (used after reconnect to restore
   * the player's position from the server's authoritative charIndex).
   * Clamps to passage length.
   */
  resumeFrom(charIndex: number): void {
    this._cursorPos = Math.min(charIndex, this.passage.length);
  }

  reset(): void {
    this._cursorPos = 0;
    this._errors = 0;
    this._hasError = false;
    this._totalKeystrokes = 0;
    this._correctKeystrokes = 0;
    this._clientGhostData = [];
    this._isComposing = false;
  }
}
