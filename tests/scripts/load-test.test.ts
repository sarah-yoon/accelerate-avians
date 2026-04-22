import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import {
  assertLocalhostTarget,
  acquireLockfile,
  releaseLockfile,
  LOCKFILE_PATH,
} from "../../scripts/load-test";

describe("assertLocalhostTarget", () => {
  it("accepts localhost, 127.0.0.1, ::1", () => {
    expect(() => assertLocalhostTarget("ws://localhost:3001")).not.toThrow();
    expect(() => assertLocalhostTarget("ws://127.0.0.1:3001")).not.toThrow();
    expect(() => assertLocalhostTarget("ws://[::1]:3001")).not.toThrow();
  });

  it("rejects non-localhost hostnames", () => {
    expect(() => assertLocalhostTarget("wss://accelerate-avians.up.railway.app")).toThrow(/non-local/i);
    expect(() => assertLocalhostTarget("ws://staging.example.com:3001")).toThrow(/non-local/i);
  });

  it("accepts non-localhost only when ALLOW_NON_LOCAL=1 is set", () => {
    const orig = process.env.ALLOW_NON_LOCAL;
    try {
      process.env.ALLOW_NON_LOCAL = "1";
      expect(() => assertLocalhostTarget("ws://staging.example.com:3001")).not.toThrow();
    } finally {
      if (orig === undefined) delete process.env.ALLOW_NON_LOCAL;
      else process.env.ALLOW_NON_LOCAL = orig;
    }
  });
});

describe("lockfile", () => {
  beforeEach(() => {
    if (existsSync(LOCKFILE_PATH)) unlinkSync(LOCKFILE_PATH);
  });

  afterEach(() => {
    if (existsSync(LOCKFILE_PATH)) unlinkSync(LOCKFILE_PATH);
  });

  it("acquires then releases the lockfile", () => {
    acquireLockfile();
    expect(existsSync(LOCKFILE_PATH)).toBe(true);
    releaseLockfile();
    expect(existsSync(LOCKFILE_PATH)).toBe(false);
  });

  it("refuses a second acquire when the held PID is still alive", () => {
    acquireLockfile();
    expect(() => acquireLockfile()).toThrow(/already running/i);
  });

  it("steals the lockfile when the held PID is dead", () => {
    writeFileSync(LOCKFILE_PATH, "999999");
    expect(() => acquireLockfile()).not.toThrow();
    expect(existsSync(LOCKFILE_PATH)).toBe(true);
  });
});
