import type { ProtocolEvent, TestStatus } from "../types";

type LiveResultsProps = {
  status: TestStatus;
  events: ProtocolEvent[];
};

type StepState = "pending" | "active" | "success" | "error";

interface Step {
  label: string;
  detail: string;
  state: StepState;
  timing?: string;
}

function deriveSteps(events: ProtocolEvent[], status: TestStatus): Step[] {
  const allLines = events.map((e) => e.line);
  const has = (pattern: string) => allLines.some((l) => l.includes(pattern));
  const hasError = status === "error";
  const isRunning = status === "running";

  const started = events.length > 0;
  const connected = has("connection established");
  const greeted = events.some((e) => e.type === "server" && /^220/.test(e.line));
  const ehloSent = events.some((e) => e.type === "client" && e.line.startsWith("EHLO"));
  const authStarted = has("Attempting authentication");
  const authDone = has("Authentication succeeded") || has("skipping auth");
  const testDone = has("SMTP test complete");
  const handshakeDone = authStarted || testDone;

  // Compute timing from first event baseline
  const t0 = events.length > 0 ? new Date(events[0].t).getTime() : null;
  const msAt = (pattern: string): string | undefined => {
    if (!t0) return undefined;
    const ev = events.find((e) => e.line.includes(pattern));
    if (!ev) return undefined;
    return `${new Date(ev.t).getTime() - t0}ms`;
  };

  const steps: Step[] = [];

  // Step 1: Connect
  const connectDone = connected;
  steps.push({
    label: "Connecting to Server",
    detail: connected ? "Socket established" : "Opening TCP socket...",
    state: connectDone
      ? "success"
      : started && !connected
        ? hasError
          ? "error"
          : "active"
        : "pending",
    timing: connectDone ? msAt("connection established") ?? msAt("TLS connection established") : undefined,
  });

  // Step 2: EHLO Handshake
  steps.push({
    label: "EHLO Handshake",
    detail: ehloSent ? "Negotiating server capabilities" : "Awaiting server greeting...",
    state: handshakeDone
      ? "success"
      : !connected
        ? "pending"
        : hasError && !authStarted
          ? "error"
          : greeted || ehloSent
            ? "active"
            : "pending",
    timing: handshakeDone ? msAt("Attempting authentication") ?? msAt("SMTP test complete") : undefined,
  });

  // Step 3: Authentication
  const authSkipped = has("skipping auth") || has("No credentials provided");
  steps.push({
    label: "Authentication",
    detail: authSkipped
      ? "No credentials — skipped"
      : authStarted
        ? "Verifying SASL credentials"
        : "Waiting for handshake...",
    state: authDone || authSkipped
      ? "success"
      : !handshakeDone
        ? "pending"
        : hasError && authStarted
          ? "error"
          : authStarted
            ? "active"
            : "pending",
    timing: authDone ? msAt("Authentication succeeded") : undefined,
  });

  // Step 4: Complete
  steps.push({
    label: "Test Complete",
    detail: testDone ? "NOOP + QUIT sent successfully" : "Finalizing session...",
    state: testDone
      ? "success"
      : hasError
        ? "pending"
        : authDone && isRunning
          ? "active"
          : "pending",
    timing: testDone ? msAt("SMTP test complete") : undefined,
  });

  return steps;
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "success") {
    return (
      <div className="w-6 h-6 rounded-full bg-tertiary/20 flex items-center justify-center flex-shrink-0">
        <span
          className="material-symbols-outlined text-[16px] text-tertiary"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          check_circle
        </span>
      </div>
    );
  }
  if (state === "active") {
    return (
      <div className="w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0">
        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="w-6 h-6 rounded-full bg-error/10 flex items-center justify-center flex-shrink-0">
        <span
          className="material-symbols-outlined text-[16px] text-error"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          cancel
        </span>
      </div>
    );
  }
  // pending
  return (
    <div className="w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0">
      <span className="material-symbols-outlined text-[16px] text-outline">pending</span>
    </div>
  );
}

const statusLabel: Record<TestStatus, string> = {
  idle: "Idle",
  running: "Active",
  success: "Complete",
  error: "Error",
};

const statusDotClass: Record<TestStatus, string> = {
  idle: "bg-on-surface-variant",
  running: "bg-tertiary animate-pulse",
  success: "bg-primary-fixed-dim",
  error: "bg-error",
};

const statusTextClass: Record<TestStatus, string> = {
  idle: "text-on-surface-variant",
  running: "text-tertiary",
  success: "text-primary-fixed-dim",
  error: "text-error",
};

export default function LiveResults({ status, events }: LiveResultsProps) {
  const steps = deriveSteps(events, status);

  return (
    <div className="bg-surface-container rounded-xl p-8 flex-1">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold text-on-surface">Live Results</h3>
        <div className="flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${statusDotClass[status]}`} />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${statusTextClass[status]}`}>
            {statusLabel[status]}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-start space-x-4 transition-opacity ${step.state === "pending" ? "opacity-40" : "opacity-100"}`}
          >
            <div className="mt-0.5">
              <StepIcon state={step.state} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center gap-2">
                <p className="text-sm font-semibold text-on-surface truncate">{step.label}</p>
                {step.timing && (
                  <span
                    className={`text-[10px] font-mono flex-shrink-0 ${
                      step.state === "success" ? "text-tertiary" : "text-primary animate-pulse"
                    }`}
                  >
                    {step.timing}
                  </span>
                )}
                {step.state === "active" && !step.timing && (
                  <span className="text-[10px] font-mono text-primary animate-pulse flex-shrink-0">
                    Processing...
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {status === "idle" && events.length === 0 && (
        <p className="text-xs text-on-surface-variant/60 mt-6">
          Run a test to see live results.
        </p>
      )}
    </div>
  );
}
