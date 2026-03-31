export class BirdSprite {
  private frameCount: number;
  private fps: number;
  private msPerFrame: number;
  private accumulator = 0;
  private _currentFrame = 0;

  constructor(frameCount: number, fps: number) {
    this.frameCount = frameCount;
    this.fps = fps;
    this.msPerFrame = 1000 / fps;
  }

  get currentFrame(): number {
    return this._currentFrame;
  }

  update(deltaMs: number): void {
    this.accumulator += deltaMs;
    while (this.accumulator >= this.msPerFrame) {
      this.accumulator -= this.msPerFrame;
      this._currentFrame = (this._currentFrame + 1) % this.frameCount;
    }
  }

  getSourceX(frameWidth: number): number {
    return this._currentFrame * frameWidth;
  }

  reset(): void {
    this._currentFrame = 0;
    this.accumulator = 0;
  }
}
