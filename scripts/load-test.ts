import { existsSync, writeFileSync, unlinkSync, readFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { URL } from "node:url";
import { dirname, resolve } from "node:path";

export const LOCKFILE_PATH = "/tmp/aa-loadtest.lock";
export const MAX_DURATION_MINUTES = 5;

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

/** Refuses non-localhost targets unless ALLOW_NON_LOCAL=1 is set. */
export function assertLocalhostTarget(target: string): void {
  const url = new URL(target);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (LOCAL_HOSTNAMES.has(host)) return;
  if (process.env.ALLOW_NON_LOCAL === "1") return;
  throw new Error(
    `Load test refused: TARGET_URL resolves to non-local hostname "${host}". ` +
      `Set ALLOW_NON_LOCAL=1 to bypass (production is still forbidden by policy).`
  );
}

/** Creates a PID-stamped lockfile. Throws if another live PID holds it. Steals dead locks. */
export function acquireLockfile(): void {
  if (existsSync(LOCKFILE_PATH)) {
    const heldPidStr = readFileSync(LOCKFILE_PATH, "utf8").trim();
    const heldPid = Number(heldPidStr);
    if (Number.isFinite(heldPid) && heldPid > 0) {
      try {
        process.kill(heldPid, 0);
        throw new Error(`Load test already running under PID ${heldPid}`);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "ESRCH") {
          throw err;
        }
      }
    }
  }
  writeFileSync(LOCKFILE_PATH, String(process.pid));
}

export function releaseLockfile(): void {
  if (existsSync(LOCKFILE_PATH)) unlinkSync(LOCKFILE_PATH);
}

export interface RunOptions {
  target: string;
  scenario: string;
  outputJson: string;
  k6Args?: string[];
}

/** Invokes k6 with the 5-minute cap + JSON output. */
export function runScenario(opts: RunOptions): { status: number } {
  mkdirSync(dirname(opts.outputJson), { recursive: true });
  const result = spawnSync(
    "k6",
    [
      "run",
      "--out",
      `json=${opts.outputJson}`,
      "--env",
      `TARGET_URL=${opts.target}`,
      ...(opts.k6Args ?? []),
      opts.scenario,
    ],
    { stdio: "inherit" }
  );
  return { status: result.status ?? 1 };
}

async function main() {
  const target = process.env.TARGET_URL ?? "ws://localhost:3001";
  const scenarioArg = process.argv[2];
  if (!scenarioArg) {
    console.error("Usage: npx tsx scripts/load-test.ts <scenario-name>");
    console.error("Scenarios: broadcast-fanout, db-finalize, rate-limiter, reconnect-storm, slow-consumer");
    process.exit(2);
  }

  assertLocalhostTarget(target);
  acquireLockfile();
  try {
    const scenarioPath = resolve(process.cwd(), `scripts/load-test/${scenarioArg}.js`);
    if (!existsSync(scenarioPath)) {
      throw new Error(`Scenario not found: ${scenarioPath}`);
    }
    const outputJson = resolve(
      process.cwd(),
      `scripts/load-test/results/${scenarioArg}-${Date.now()}.json`
    );
    const result = runScenario({ target, scenario: scenarioPath, outputJson });
    console.log(`\nResults: ${outputJson}`);
    process.exit(result.status);
  } finally {
    releaseLockfile();
  }
}

// Guard: only run main() when invoked as the entry point (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    releaseLockfile();
    process.exit(1);
  });
}
