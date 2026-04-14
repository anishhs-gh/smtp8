#!/usr/bin/env node

import * as p from "@clack/prompts";
import chalk from "chalk";
import { runSmtpTest } from "./smtpTester.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const VERSION = "2.0.0";

const HOSTED_API_URL = "https://api-ne2iz2roeq-uc.a.run.app";

const HOSTNAME_RE =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

// ─── Types ────────────────────────────────────────────────────────────────────

type EncryptionMode = "NONE" | "STARTTLS" | "SSL_TLS";

interface ProtocolEvent {
  t: string;
  type: "client" | "server" | "info" | "error";
  line: string;
}

type StepName =
  | "host"
  | "port"
  | "encryption"
  | "username"
  | "password"
  | "clientName"
  | "confirm";

interface FormValues {
  host: string;
  port: string;
  encryption: EncryptionMode;
  username: string;
  password: string;
  clientName: string;
}

// ─── Step navigation ──────────────────────────────────────────────────────────

const STEPS: StepName[] = [
  "host",
  "port",
  "encryption",
  "username",
  "password",
  "clientName",
  "confirm",
];

const DEFAULT_VALUES: FormValues = {
  host: "",
  port: "587",
  encryption: "STARTTLS",
  username: "",
  password: "",
  clientName: "smtp8.local",
};

// Default port per encryption mode — used by the non-interactive path.
const DEFAULT_PORT: Record<EncryptionMode, string> = {
  STARTTLS: "587",
  SSL_TLS: "465",
  NONE: "25",
};

// Password step is meaningless without a username — skip it transparently.
const isStepSkipped = (step: StepName, v: FormValues): boolean =>
  step === "password" && !v.username.trim();

// ESC key is not handled by @clack/prompts, so we intercept it at the raw
// keypress level and emit Ctrl+U, which readline treats as "clear to start of
// line". Call attachEscClear() before a text prompt; call the returned
// function to detach after the prompt resolves.
function attachEscClear(): () => void {
  const handler = (_str: string, key: { name?: string } | undefined) => {
    if (key?.name === "escape") {
      process.stdin.emit("keypress", "", {
        name: "u",
        ctrl: true,
        meta: false,
        shift: false,
      });
    }
  };
  process.stdin.on("keypress", handler);
  return () => process.stdin.removeListener("keypress", handler);
}

const prevStepIdx = (current: number, v: FormValues): number => {
  let i = current - 1;
  while (i > 0 && isStepSkipped(STEPS[i], v)) i--;
  return Math.max(0, i);
};

const nextStepIdx = (current: number, v: FormValues): number => {
  let i = current + 1;
  while (i < STEPS.length && isStepSkipped(STEPS[i], v)) i++;
  return i;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getArg = (flag: string): string | null => {
  const args = process.argv.slice(2);
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

const hasFlag = (flag: string): boolean =>
  process.argv.slice(2).includes(flag);

// Append a dimmed back-hint to a prompt label after the first step.
const withHint = (label: string, stepIdx: number): string =>
  stepIdx > 0
    ? `${label}  ${chalk.dim("Ctrl+C · go back")}`
    : label;

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0").slice(0, 2);
  return `${h}:${m}:${s}.${ms}`;
};

/** Parse a user-supplied encryption string into a canonical EncryptionMode. */
function parseEncryption(raw: string): EncryptionMode | null {
  switch (raw.toUpperCase().replace(/[^A-Z]/g, "_")) {
    case "STARTTLS": return "STARTTLS";
    case "SSL_TLS":
    case "SSL":
    case "TLS":      return "SSL_TLS";
    case "NONE":     return "NONE";
    default:         return null;
  }
}

/** Resolve whether to use local mode and what apiUrl to use. */
function resolveApiMode(argvSlice: string[]): { useLocalMode: boolean; apiUrl: string } {
  const getArgFrom = (flag: string): string | null => {
    const idx = argvSlice.indexOf(flag);
    return idx !== -1 && argvSlice[idx + 1] ? argvSlice[idx + 1] : null;
  };
  const hasFlagIn = (flag: string): boolean => argvSlice.includes(flag);

  const explicitApiUrl =
    getArgFrom("--api-url") ??
    (hasFlagIn("--remote") ? HOSTED_API_URL : null) ??
    process.env.SMTP8_API_URL ??
    null;

  return {
    useLocalMode: explicitApiUrl === null,
    apiUrl: explicitApiUrl ?? HOSTED_API_URL,
  };
}

// ─── Event rendering ──────────────────────────────────────────────────────────

const EVENT_STYLE: Record<
  ProtocolEvent["type"],
  { arrow: string; text: (s: string) => string }
> = {
  client: {
    arrow: chalk.hex("#adc6ff")("→"),
    text: (s) => chalk.hex("#adc6ff")(s),
  },
  server: {
    arrow: chalk.hex("#4edea3")("←"),
    text: (s) => chalk.dim(s),
  },
  info: {
    arrow: chalk.hex("#4edea3")("◆"),
    text: (s) => chalk.hex("#4edea3")(s),
  },
  error: {
    arrow: chalk.red("✕"),
    text: (s) => chalk.red(s),
  },
};

function printEvent(ev: ProtocolEvent): void {
  const style = EVENT_STYLE[ev.type];
  const time = chalk.dim(formatTime(ev.t));
  process.stdout.write(`  ${time}  ${style.arrow}  ${style.text(ev.line)}\n`);
}

// ─── Shared test runner ───────────────────────────────────────────────────────
//
// Called by both the interactive and non-interactive paths after values are
// resolved. Handles the spinner, event streaming, summary, and exit code.

async function executeTest(
  values: FormValues,
  useLocalMode: boolean,
  apiUrl: string
): Promise<void> {
  const { host, port, encryption, username, password, clientName } = values;

  const encLabel =
    encryption === "SSL_TLS"
      ? "SSL/TLS"
      : encryption === "STARTTLS"
        ? "STARTTLS"
        : "None";

  const controller = new AbortController();

  process.on("SIGINT", () => {
    controller.abort();
    process.stdout.write("\n");
    p.cancel(chalk.dim("Test cancelled."));
    process.exit(0);
  });

  const spin = p.spinner();
  spin.start(`Connecting to ${chalk.bold(host)}:${chalk.bold(port)}…`);

  let spinnerActive = true;
  let hasError = false;
  let authenticated = false;
  const startTime = Date.now();

  const stopSpinner = () => {
    if (spinnerActive) {
      spin.stop(chalk.dim("Streaming protocol events…"));
      spinnerActive = false;
      process.stdout.write("\n");
    }
  };

  if (useLocalMode) {
    // ── Local mode: run SMTP test directly without a backend ──────────────────

    try {
      await runSmtpTest(
        {
          host,
          port: Number(port),
          encryption,
          username: username || undefined,
          password: password || undefined,
          clientName: clientName || undefined,
        },
        (ev) => {
          stopSpinner();
          printEvent(ev);
          if (ev.type === "error") hasError = true;
          if (ev.line.includes("Authentication succeeded")) authenticated = true;
        },
        controller.signal
      );
    } catch (err) {
      // The error event has already been printed via the write callback.
      if ((err as Error).name !== "AbortError") stopSpinner();
      hasError = true;
    }
  } else {
    // ── Remote mode: route the test through a backend API ─────────────────────

    let response: Response;
    try {
      response = await fetch(`${apiUrl}/v1/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          port: Number(port),
          encryption,
          username: username || undefined,
          password: password || undefined,
          clientName: clientName || undefined,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      spin.stop(chalk.red("✕ Could not reach the API"));
      const msg =
        err instanceof Error && err.message.toLowerCase().includes("fetch")
          ? `API server not reachable at ${chalk.bold(apiUrl)}\n  Make sure the backend is running.`
          : String(err);
      p.log.error(msg);
      p.outro(chalk.red("Test failed."));
      process.exit(1);
    }

    if (!response.ok) {
      spin.stop(chalk.red(`✕ API error (${response.status})`));
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      p.log.error(body.error ?? `HTTP ${response.status}`);
      p.outro(chalk.red("Test failed."));
      process.exit(1);
    }

    if (!response.body) {
      spin.stop(chalk.red("✕ No response stream"));
      p.outro(chalk.red("Test failed."));
      process.exit(1);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let idx = buffer.indexOf("\n");
        while (idx !== -1) {
          const raw = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);

          if (raw) {
            let ev: ProtocolEvent;
            try {
              ev = JSON.parse(raw) as ProtocolEvent;
            } catch {
              idx = buffer.indexOf("\n");
              continue;
            }

            stopSpinner();
            printEvent(ev);

            if (ev.type === "error") hasError = true;
            if (ev.line.includes("Authentication succeeded")) authenticated = true;
          }

          idx = buffer.indexOf("\n");
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        stopSpinner();
        p.log.error(`Stream error: ${String(err)}`);
      }
      hasError = true;
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  process.stdout.write("\n");

  if (hasError) {
    p.note(
      [
        `${chalk.dim("Host")}        ${host}:${port}`,
        `${chalk.dim("Encryption")}  ${encLabel}`,
        `${chalk.dim("Auth")}        ${authenticated ? chalk.hex("#4edea3")("succeeded") : chalk.red("failed / skipped")}`,
        `${chalk.dim("Duration")}    ${duration}s`,
      ].join("\n"),
      chalk.red("✕  Test failed")
    );
    p.outro(chalk.red("Check the protocol log above for details."));
    process.exit(1);
  } else {
    p.note(
      [
        `${chalk.dim("Host")}        ${chalk.white(host)}:${chalk.white(port)}`,
        `${chalk.dim("Encryption")}  ${chalk.hex("#4edea3")(encLabel)}`,
        `${chalk.dim("Auth")}        ${username ? chalk.hex("#4edea3")("succeeded") : chalk.dim("skipped — no credentials")}`,
        `${chalk.dim("Duration")}    ${chalk.hex("#4edea3")(duration + "s")}`,
      ].join("\n"),
      chalk.hex("#4edea3")("✓  Test passed")
    );
    p.outro(chalk.hex("#4edea3")("All good."));
  }
}

// ─── Help ─────────────────────────────────────────────────────────────────────

function printHelp(): void {
  console.log(`
${chalk.bold.hex("#4edea3")("smtp8")} ${chalk.dim(`v${VERSION}`)} — SMTP Tester CLI

${chalk.bold("Usage:")}
  smtp8 [options]                    Interactive mode
  smtp8 test [flags]                 Non-interactive mode

${chalk.bold("Global options:")}
  --remote              Route the test through the hosted smtp8 API
  --api-url <url>       Route the test through a custom API URL (local or remote)
  --version, -v         Print version and exit
  --help, -h            Show this help

${chalk.bold("test flags:")}
  --host <host>         SMTP server hostname ${chalk.dim("(required)")}
  --port <port>         Port number ${chalk.dim("(default: 587 / 465 / 25 based on encryption)")}
  --encryption <mode>   STARTTLS ${chalk.dim("(default)")} · SSL_TLS · NONE
  --username <user>     Username for authentication ${chalk.dim("(optional)")}
  --password <pass>     Password for authentication ${chalk.dim("(optional, prefer SMTP8_PASSWORD)")}
  --client-name <name>  EHLO client name ${chalk.dim("(default: smtp8.local)")}

${chalk.bold("Interactive navigation:")}
  Tab                   Autofill the placeholder value
  Ctrl+C                Go back to the previous field (on the first field: exit)
  ESC                   Clear the current input field

${chalk.bold("Environment:")}
  SMTP8_API_URL         Route through an API URL (overridden by --api-url)
  SMTP8_PASSWORD        Password for the test subcommand (safer than --password)

${chalk.bold("Examples:")}
  smtp8                                            # interactive, runs directly
  smtp8 test --host smtp.gmail.com                 # non-interactive, STARTTLS on 587
  smtp8 test --host mail.example.com --port 465 --encryption SSL_TLS
  smtp8 test --host smtp.gmail.com --username u@gmail.com --password secret
  smtp8 test --host smtp.gmail.com --remote        # route through hosted API
  smtp8 --remote                                   # interactive via hosted API
  smtp8 --api-url https://api.example.com          # interactive via custom API
`);
}

function printTestHelp(): void {
  console.log(`
${chalk.bold.hex("#4edea3")("smtp8 test")} — Non-interactive SMTP test

${chalk.bold("Usage:")}
  smtp8 test --host <host> [flags]

${chalk.bold("Flags:")}
  --host <host>         SMTP server hostname ${chalk.dim("(required)")}
  --port <port>         Port number ${chalk.dim("(default: 587 / 465 / 25 based on encryption)")}
  --encryption <mode>   STARTTLS ${chalk.dim("(default)")} · SSL_TLS · NONE
  --username <user>     Username for authentication ${chalk.dim("(optional)")}
  --password <pass>     Password for authentication ${chalk.dim("(optional, prefer SMTP8_PASSWORD)")}
  --client-name <name>  EHLO client name ${chalk.dim("(default: smtp8.local)")}
  --remote              Route through the hosted smtp8 API
  --api-url <url>       Route through a custom API URL
  --help, -h            Show this help

${chalk.bold("Environment:")}
  SMTP8_API_URL         Route through an API URL (overridden by --api-url)
  SMTP8_PASSWORD        Password (safer than --password; overridden by --password)

${chalk.bold("Examples:")}
  smtp8 test --host smtp.gmail.com
  smtp8 test --host smtp.gmail.com --port 465 --encryption SSL_TLS
  smtp8 test --host smtp.gmail.com --username user@gmail.com --password s3cr3t
  SMTP8_PASSWORD=s3cr3t smtp8 test --host smtp.gmail.com --username user@gmail.com
`);
}

// ─── Non-interactive subcommand ───────────────────────────────────────────────

async function runTestCommand(): Promise<void> {
  const subArgv = process.argv.slice(3); // everything after "test"

  const getSubArg = (flag: string): string | null => {
    const idx = subArgv.indexOf(flag);
    return idx !== -1 && subArgv[idx + 1] ? subArgv[idx + 1] : null;
  };
  const hasSubFlag = (flag: string): boolean => subArgv.includes(flag);

  if (hasSubFlag("--help") || hasSubFlag("-h")) {
    printTestHelp();
    process.exit(0);
  }

  // ── Parse & validate ─────────────────────────────────────────────────────────

  const errors: string[] = [];

  const host = getSubArg("--host")?.trim() ?? "";
  if (!host) {
    errors.push("--host is required");
  } else if (!HOSTNAME_RE.test(host)) {
    errors.push(`--host: invalid hostname "${host}"`);
  }

  const rawEncryption = getSubArg("--encryption") ?? "STARTTLS";
  const encryption = parseEncryption(rawEncryption);
  if (!encryption) {
    errors.push(`--encryption: must be STARTTLS, SSL_TLS, or NONE (got "${rawEncryption}")`);
  }

  const resolvedEncryption = encryption ?? "STARTTLS";
  const rawPort = getSubArg("--port") ?? DEFAULT_PORT[resolvedEncryption];
  const portNum = Number(rawPort);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    errors.push(`--port: must be an integer between 1 and 65535 (got "${rawPort}")`);
  }

  const username = getSubArg("--username")?.trim() ?? "";
  // --password flag, then SMTP8_PASSWORD env var
  const password = getSubArg("--password") ?? process.env.SMTP8_PASSWORD ?? "";

  if (username && !password) {
    errors.push("--username is set but no password was provided (use --password or SMTP8_PASSWORD)");
  }

  const clientName = getSubArg("--client-name")?.trim() || DEFAULT_VALUES.clientName;

  if (errors.length > 0) {
    for (const e of errors) process.stderr.write(`${chalk.red("error:")} ${e}\n`);
    process.stderr.write(`\nRun ${chalk.bold("smtp8 test --help")} for usage.\n`);
    process.exit(1);
  }

  // ── Resolve API mode ─────────────────────────────────────────────────────────

  const { useLocalMode, apiUrl } = resolveApiMode(subArgv);

  // ── Header & run ─────────────────────────────────────────────────────────────

  console.log();
  p.intro(
    `${chalk.bold.hex("#4edea3")("SMTP8 CLI")}  ${chalk.dim("·")}  ${chalk.dim(`smtp8 v${VERSION}`)}`
  );

  await executeTest(
    {
      host,
      port: String(portNum),
      encryption: resolvedEncryption,
      username,
      password,
      clientName,
    },
    useLocalMode,
    apiUrl
  );
}

// ─── Interactive mode ─────────────────────────────────────────────────────────

async function runInteractive(): Promise<void> {
  const { useLocalMode, apiUrl } = resolveApiMode(process.argv.slice(2));

  console.log();
  p.intro(
    `${chalk.bold.hex("#4edea3")("SMTP8 CLI")}  ${chalk.dim("·")}  ${chalk.dim(`smtp8 v${VERSION}`)}`
  );

  // ── Step-based prompt loop ───────────────────────────────────────────────────
  //
  // Ctrl+C on any prompt returns the cancel symbol from @clack/prompts.
  // Instead of exiting, we navigate back to the previous step (or exit if
  // we are already on the first step). Values are stored so each field
  // pre-fills with the previously entered answer when the user goes back.

  let stepIdx = 0;
  const values: FormValues = { ...DEFAULT_VALUES };

  while (stepIdx < STEPS.length) {
    const step = STEPS[stepIdx];
    const isFirst = stepIdx === 0;

    let raw: unknown;

    switch (step) {
      // ── Host ────────────────────────────────────────────────────────────────
      case "host": {
        const detach = attachEscClear();
        raw = await p.text({
          message: withHint("Host address", stepIdx),
          placeholder: "smtp.gmail.com",
          initialValue: values.host,
          validate: (v) => {
            if (!v.trim()) return "Host is required.";
            if (!HOSTNAME_RE.test(v.trim()))
              return "Invalid hostname — e.g. smtp.provider.com";
          },
        });
        detach();
        break;
      }

      // ── Port ─────────────────────────────────────────────────────────────────
      case "port": {
        const detach = attachEscClear();
        raw = await p.text({
          message: withHint("Port", stepIdx),
          placeholder: "587",
          initialValue: values.port,
          validate: (v) => {
            const n = Number(v);
            if (!Number.isInteger(n) || n < 1 || n > 65535)
              return "Must be an integer between 1 and 65535.";
          },
        });
        detach();
        break;
      }

      // ── Encryption ───────────────────────────────────────────────────────────
      case "encryption": {
        raw = await p.select<
          { value: EncryptionMode; label: string; hint: string }[],
          EncryptionMode
        >({
          message: withHint("Encryption", stepIdx),
          initialValue: values.encryption,
          options: [
            { value: "STARTTLS", label: "STARTTLS",  hint: "port 587 — recommended" },
            { value: "SSL_TLS",  label: "SSL / TLS", hint: "port 465" },
            { value: "NONE",     label: "None",       hint: "port 25 — no encryption" },
          ],
        });
        break;
      }

      // ── Username ─────────────────────────────────────────────────────────────
      case "username": {
        const detach = attachEscClear();
        raw = await p.text({
          message: withHint("Username", stepIdx),
          placeholder: "leave empty to skip authentication",
          initialValue: values.username,
        });
        detach();
        break;
      }

      // ── Password (skipped when username is empty) ─────────────────────────────
      case "password": {
        raw = await p.password({
          message: withHint("Password", stepIdx),
          mask: "•",
          validate: (v) => {
            if (!v) return "Password is required when a username is set.";
          },
        });
        break;
      }

      // ── Client name ──────────────────────────────────────────────────────────
      case "clientName": {
        const detach = attachEscClear();
        raw = await p.text({
          message: withHint("Client name", stepIdx),
          placeholder: "smtp8.local",
          initialValue: values.clientName,
        });
        detach();
        break;
      }

      // ── Confirm ──────────────────────────────────────────────────────────────
      case "confirm": {
        const encLabel =
          values.encryption === "SSL_TLS"
            ? "SSL/TLS"
            : values.encryption === "STARTTLS"
              ? "STARTTLS"
              : "None";

        p.note(
          [
            `${chalk.dim("Host")}        ${chalk.white(values.host.trim())}:${chalk.white(values.port)}`,
            `${chalk.dim("Encryption")}  ${chalk.hex("#4edea3")(encLabel)}`,
            `${chalk.dim("Auth")}        ${values.username.trim() ? chalk.white(values.username.trim()) : chalk.dim("skipped")}`,
          ].join("\n"),
          "Configuration"
        );

        raw = await p.confirm({
          message: withHint("Run SMTP test?", stepIdx),
        });
        break;
      }
    }

    // ── Cancel (Ctrl+C) → go back ─────────────────────────────────────────────
    if (p.isCancel(raw)) {
      if (isFirst) {
        p.cancel(chalk.dim("Cancelled."));
        process.exit(0);
      }
      // Clear stored password when going back through it — never leave
      // a stale credential in memory longer than needed.
      if (step === "password" || stepIdx <= STEPS.indexOf("password")) {
        values.password = "";
      }
      stepIdx = prevStepIdx(stepIdx, values);
      continue;
    }

    // ── Store value and advance ───────────────────────────────────────────────
    switch (step) {
      case "host":       values.host       = (raw as string).trim(); break;
      case "port":       values.port       = (raw as string).trim(); break;
      case "encryption": values.encryption = raw as EncryptionMode;  break;
      case "username":   values.username   = ((raw as string) ?? "").trim(); break;
      case "password":   values.password   = raw as string;                  break;
      case "clientName": values.clientName = ((raw as string) ?? "").trim(); break;
      case "confirm":
        if (raw === false) {
          p.cancel(chalk.dim("Aborted."));
          process.exit(0);
        }
        break;
    }

    stepIdx = nextStepIdx(stepIdx, values);
  }

  await executeTest(values, useLocalMode, apiUrl);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const subcommand = process.argv[2];

  // Dispatch to the subcommand first so it can own its own --help output.
  if (subcommand === "test") {
    await runTestCommand();
    return;
  }

  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    process.exit(0);
  }

  if (hasFlag("--version") || hasFlag("-v")) {
    console.log(`smtp8 v${VERSION}`);
    process.exit(0);
  }

  await runInteractive();
}

main().catch((err) => {
  console.error(chalk.red("Unexpected error:"), err);
  process.exit(1);
});
