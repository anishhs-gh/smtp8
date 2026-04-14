/**
 * CLI integration tests.
 *
 * These tests spawn the built binary (dist/index.js) as a child process, so
 * `npm run build` must complete before `npm test` runs. In CI the workflow
 * enforces that order explicitly.
 *
 * Interactive prompt paths are not tested here — they require a real TTY and
 * live SMTP credentials. We focus on the non-interactive flag surface that is
 * easily exercised in a headless environment.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const BIN = join(__dirname, "../dist/index.js");

function run(
  args: string[],
  env?: Record<string, string>
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync("node", [BIN, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 5000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

// ── Version flag ───────────────────────────────────────────────────────────────

describe("version flag", () => {
  it("--version prints version string and exits 0", () => {
    const { stdout, status } = run(["--version"]);
    expect(status).toBe(0);
    expect(stdout.trim()).toMatch(/^smtp8 v\d+\.\d+\.\d+$/);
  });

  it("-v is an alias for --version", () => {
    const { stdout, status } = run(["-v"]);
    expect(status).toBe(0);
    expect(stdout.trim()).toMatch(/^smtp8 v\d+\.\d+\.\d+$/);
  });

  it("--version and -v print the same output", () => {
    const long = run(["--version"]).stdout.trim();
    const short = run(["-v"]).stdout.trim();
    expect(long).toBe(short);
  });
});

// ── Help flag ─────────────────────────────────────────────────────────────────

describe("help flag", () => {
  it("--help exits 0 and contains flag documentation", () => {
    const { stdout, status } = run(["--help"]);
    expect(status).toBe(0);
    expect(stdout).toContain("--api-url");
    expect(stdout).toContain("--local");
    expect(stdout).toContain("--version");
    expect(stdout).toContain("--help");
  });

  it("-h is an alias for --help", () => {
    const { stdout, status } = run(["-h"]);
    expect(status).toBe(0);
    expect(stdout).toContain("--api-url");
  });

  it("help output documents the SMTP8_API_URL env var", () => {
    const { stdout } = run(["--help"]);
    expect(stdout).toContain("SMTP8_API_URL");
  });

  it("help output documents Tab autofill navigation", () => {
    const { stdout } = run(["--help"]);
    expect(stdout).toContain("Tab");
  });

  it("help output shows usage examples", () => {
    const { stdout } = run(["--help"]);
    expect(stdout).toContain("smtp8 --local");
  });
});

// ── Version consistency ────────────────────────────────────────────────────────

describe("version value", () => {
  it("version in binary matches package.json version", async () => {
    const { stdout } = run(["--version"]);
    const pkg = await import("../package.json", { assert: { type: "json" } });
    const binVersion = stdout.trim().replace("smtp8 v", "");
    expect(binVersion).toBe(pkg.default.version);
  });
});
