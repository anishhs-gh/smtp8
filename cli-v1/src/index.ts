#!/usr/bin/env node

import * as p from "@clack/prompts";
import chalk from "chalk";

// ─── Constants ────────────────────────────────────────────────────────────────

const VERSION = "1.1.0";

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

// ─── Help ─────────────────────────────────────────────────────────────────────

function printHelp(): void {
  console.log(`
${chalk.bold.hex("#4edea3")("smtp8")} ${chalk.dim(`v${VERSION}`)} — SMTP Tester CLI

${chalk.bold("Usage:")}
  smtp8 [options]

${chalk.bold("Options:")}
  --api-url <url>   Backend API base URL (overrides all other sources)
  --local           Use http://localhost:8081 (local dev shorthand)
  --version, -v     Print version and exit
  --help, -h        Show this help

${chalk.bold("Navigation:")}
  Tab               Autofill the placeholder value
  Ctrl+C            Go back to the previous field
                    (on the first field: exit)
  ESC               Clear the current input field

${chalk.bold("Environment:")}
  SMTP8_API_URL     Override the API URL (overridden by --api-url)

${chalk.bold("Examples:")}
  smtp8                                       # uses deployed API
  smtp8 --local                               # uses localhost:8081
  smtp8 --api-url https://api.example.com     # custom URL
  SMTP8_API_URL=https://api.example.com smtp8
`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    process.exit(0);
  }

  if (hasFlag("--version") || hasFlag("-v")) {
    console.log(`smtp8 v${VERSION}`);
    process.exit(0);
  }

  const apiUrl =
    getArg("--api-url") ??
    (hasFlag("--local") ? "http://localhost:8081" : null) ??
    process.env.SMTP8_API_URL ??
    "https://api-ne2iz2roeq-uc.a.run.app";

  // ── Header ──────────────────────────────────────────────────────────────────
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

  // ── Extract confirmed values ──────────────────────────────────────────────────
  const { host, port, encryption, username, password, clientName } = values;

  const encLabel =
    encryption === "SSL_TLS"
      ? "SSL/TLS"
      : encryption === "STARTTLS"
        ? "STARTTLS"
        : "None";

  // ── Run test ─────────────────────────────────────────────────────────────────

  const controller = new AbortController();

  process.on("SIGINT", () => {
    controller.abort();
    process.stdout.write("\n");
    p.cancel(chalk.dim("Test cancelled."));
    process.exit(0);
  });

  const spin = p.spinner();
  spin.start(
    `Connecting to ${chalk.bold(host)}:${chalk.bold(port)}…`
  );

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
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    p.log.error(body.error ?? `HTTP ${response.status}`);
    p.outro(chalk.red("Test failed."));
    process.exit(1);
  }

  if (!response.body) {
    spin.stop(chalk.red("✕ No response stream"));
    p.outro(chalk.red("Test failed."));
    process.exit(1);
  }

  // ── Stream events ────────────────────────────────────────────────────────────

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
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

main().catch((err) => {
  console.error(chalk.red("Unexpected error:"), err);
  process.exit(1);
});
