import { describe, it, expect } from "vitest";
import { ClockSync } from "@/lib/clock-sync";

describe("ClockSync", () => {
  it("isReady() is false before 5 handshake samples", () => {
    const sync = new ClockSync();
    for (let i = 0; i < 4; i++) {
      sync.recordHandshake({ serverTime: 1000, clientSendTime: 0, clientReceiveTime: 50 });
    }
    expect(sync.isReady()).toBe(false);
  });

  it("isReady() becomes true after 5 samples", () => {
    const sync = new ClockSync();
    for (let i = 0; i < 5; i++) {
      sync.recordHandshake({ serverTime: 1000, clientSendTime: 0, clientReceiveTime: 50 });
    }
    expect(sync.isReady()).toBe(true);
  });

  it("discards min and max of the first 5 samples (median-of-5 seed)", () => {
    const sync = new ClockSync();
    // Each sample: offset = serverTime - (clientSendTime + (clientReceiveTime - clientSendTime)/2)
    // Samples A-C: tight ~975 offset
    // Sample D: outlier ~1500 offset (would pull a naive average)
    // Sample E: outlier ~500 offset (would pull a naive average)
    sync.recordHandshake({ serverTime: 1000, clientSendTime: 0,   clientReceiveTime: 50 });  // offset = 1000 - 25 = 975
    sync.recordHandshake({ serverTime: 1026, clientSendTime: 52,  clientReceiveTime: 104 }); // offset = 1026 - 78 = 948
    sync.recordHandshake({ serverTime: 1051, clientSendTime: 102, clientReceiveTime: 153 }); // offset = 1051 - 127.5 = 923.5
    sync.recordHandshake({ serverTime: 1700, clientSendTime: 150, clientReceiveTime: 250 }); // offset = 1700 - 200 = 1500 (outlier high)
    sync.recordHandshake({ serverTime: 500,  clientSendTime: 200, clientReceiveTime: 300 }); // offset = 500 - 250 = 250 (outlier low)
    // After median-of-5 (discard highest 1500 + lowest 250), average of the 3 tight samples ≈ 948.83
    expect(sync.offsetMs).toBeGreaterThan(900);
    expect(sync.offsetMs).toBeLessThan(1000);
  });

  it("toServerTime(clientTime) returns clientTime + offset", () => {
    const sync = new ClockSync();
    for (let i = 0; i < 5; i++) {
      sync.recordHandshake({ serverTime: 1000, clientSendTime: 0, clientReceiveTime: 50 });
    }
    // offset = 1000 - 25 = 975
    expect(sync.toServerTime(100)).toBeCloseTo(100 + 975, -1);
  });

  it("after 5 samples, further recordings update offset via EMA", () => {
    const sync = new ClockSync();
    // 5 identical samples → offset = 975
    for (let i = 0; i < 5; i++) {
      sync.recordHandshake({ serverTime: 1000, clientSendTime: 0, clientReceiveTime: 50 });
    }
    const initial = sync.offsetMs;
    // New sample with offset = 2000 - 25 = 1975; EMA with alpha=0.3 moves offset toward 1975
    sync.recordHandshake({ serverTime: 2000, clientSendTime: 0, clientReceiveTime: 50 });
    expect(sync.offsetMs).toBeGreaterThan(initial);
    expect(sync.offsetMs).toBeLessThan(1975);
  });
});
