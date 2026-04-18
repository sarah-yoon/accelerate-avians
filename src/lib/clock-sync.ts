interface Sample {
  serverTime: number;
  clientSendTime: number;
  clientReceiveTime: number;
}

export class ClockSync {
  private handshakeSamples: number[] = [];
  private emaOffset = 0;
  private readonly ALPHA = 0.3;

  get offsetMs(): number {
    return this.emaOffset;
  }

  isReady(): boolean {
    return this.handshakeSamples.length >= 5;
  }

  recordHandshake(s: Sample): void {
    const rtt = s.clientReceiveTime - s.clientSendTime;
    const oneWay = rtt / 2;
    const offset = s.serverTime - (s.clientSendTime + oneWay);
    this.handshakeSamples.push(offset);
    if (this.handshakeSamples.length === 5) {
      const sorted = [...this.handshakeSamples].sort((a, b) => a - b);
      // Discard min (idx 0) + max (idx 4), average middle three.
      this.emaOffset = (sorted[1] + sorted[2] + sorted[3]) / 3;
    } else if (this.handshakeSamples.length > 5) {
      this.emaOffset = this.ALPHA * offset + (1 - this.ALPHA) * this.emaOffset;
    }
  }

  toServerTime(clientTime: number): number {
    return clientTime + this.emaOffset;
  }
}
