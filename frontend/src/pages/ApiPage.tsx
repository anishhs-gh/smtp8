import React from "react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8081";

// When API_BASE is a relative path (e.g. /api in production), build the full
// URL so code examples and the Base URL row show something copy-pasteable.
const DISPLAY_URL =
  typeof window !== "undefined" && API_BASE.startsWith("/")
    ? `${window.location.origin}${API_BASE}`
    : API_BASE;

function CodeBlock({ children, lang = "json" }: { children: string; lang?: string }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant/10">
        <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-mono font-bold">
          {lang}
        </span>
      </div>
      <pre className="px-5 py-4 font-mono text-[12px] text-on-surface-variant leading-relaxed overflow-x-auto custom-scrollbar whitespace-pre">
        {children}
      </pre>
    </div>
  );
}

function Badge({ label, color = "primary" }: { label: string; color?: "primary" | "tertiary" | "error" }) {
  const cls = {
    primary: "bg-primary/10 text-primary",
    tertiary: "bg-tertiary/10 text-tertiary",
    error: "bg-error/10 text-error",
  }[color];
  return (
    <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${cls}`}>{label}</span>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-5">
      <h2 className="text-xl font-bold text-on-surface pb-3 border-b border-outline-variant/15">{title}</h2>
      <div className="space-y-5 text-[15px] text-on-surface-variant leading-relaxed">{children}</div>
    </section>
  );
}

export default function ApiPage() {
  return (
    <main className="pt-28 px-10 pb-16">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-3">API Reference</h1>
          <p className="text-on-surface-variant text-[15px] max-w-xl">
            Integrate SMTP testing into your own tooling via the HTTP streaming API.
          </p>
        </div>

        {/* On-page nav */}
        <nav className="mb-12 flex flex-wrap gap-3">
          {[
            ["#overview", "Overview"],
            ["#test", "POST /v1/test"],
            ["#events", "Event Types"],
            ["#health", "GET /health"],
            ["#examples", "Code Examples"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="px-3 py-1.5 bg-surface-container rounded-lg text-xs font-medium text-on-surface-variant hover:text-tertiary hover:bg-surface-container-high transition-all"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="space-y-14">
          {/* Overview */}
          <Section id="overview" title="Overview">
            <div className="bg-surface-container rounded-xl overflow-hidden">
              {[
                ["Base URL", DISPLAY_URL],
                ["Authentication", "None (Phase 1)"],
                ["Rate Limit", "10 requests / 60 s per IP on /v1/test"],
                ["Global Limit", "120 requests / 15 min per IP"],
                ["Response Format", "application/x-ndjson (newline-delimited JSON stream)"],
                ["Credentials policy", "Never stored, never logged. Memory-only for test duration."],
              ].map(([k, v]) => (
                <div key={k as string} className="flex gap-6 px-5 py-3.5 border-b border-outline-variant/10 last:border-0">
                  <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold w-40 flex-shrink-0 pt-0.5">
                    {k}
                  </span>
                  <span className="font-mono text-[13px] text-on-surface">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-sm">
              The test endpoint returns a streaming NDJSON response — one JSON object per line,
              flushed as each protocol event occurs. Read the stream incrementally; do not wait
              for the full body before parsing.
            </p>
          </Section>

          {/* POST /v1/test */}
          <Section id="test" title="POST /v1/test">
            <p className="text-sm">
              Initiates an SMTP test session. The response streams protocol events until the session
              completes or the client disconnects.
            </p>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-on-surface">Request body</p>
              <CodeBlock lang="typescript">{`{
  host:        string   // required — RFC-1123 hostname, max 255 chars
  port:        number   // required — integer, 1–65535
  encryption:  string   // required — "NONE" | "STARTTLS" | "SSL_TLS"
  username?:   string   // optional — SMTP auth username, max 320 chars
  password?:   string   // optional — SMTP auth password, max 1024 chars
  clientName?: string   // optional — EHLO hostname, max 255 chars
  timeoutMs?:  number   // optional — integer, 1–60000 (default: 15000)
}`}</CodeBlock>
            </div>

            <div className="bg-surface-container rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-outline-variant/10">
                <p className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">Response codes</p>
              </div>
              {[
                ["200", "primary", "Streaming response started. Read NDJSON events from the body."],
                ["400", "error", "Invalid request body. JSON error object returned: { error: string }"],
                ["429", "error", "Rate limit exceeded. Retry after the indicated window."],
              ].map(([code, color, desc]) => (
                <div key={code as string} className="flex items-start gap-4 px-5 py-3.5 border-b border-outline-variant/10 last:border-0">
                  <Badge label={code as string} color={color as "primary" | "error"} />
                  <span className="text-sm text-on-surface-variant">{desc as string}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-on-surface">Validation rules</p>
              <ul className="text-sm list-none space-y-1 pl-0">
                {[
                  "username and password must be provided together or not at all",
                  "host must match RFC-1123 hostname format — IP addresses are rejected",
                  "All string fields are length-capped to prevent DoS via large payloads",
                  "Request body is limited to 8 KB",
                ].map((rule) => (
                  <li key={rule} className="flex items-start gap-2">
                    <span className="text-tertiary mt-1">›</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          {/* Event Types */}
          <Section id="events" title="Event Types">
            <p className="text-sm">
              Each line in the NDJSON stream is a protocol event:
            </p>
            <CodeBlock lang="typescript">{`{
  t:    string  // ISO 8601 timestamp (e.g. "2025-04-08T14:02:01.460Z")
  type: "client" | "server" | "info" | "error"
  line: string  // human-readable protocol line
}`}</CodeBlock>

            <div className="bg-surface-container rounded-xl overflow-hidden">
              {[
                {
                  type: "client",
                  color: "text-primary-fixed-dim",
                  desc: "Commands sent by the tester to the SMTP server (EHLO, STARTTLS, AUTH, NOOP, QUIT). Credentials are always replaced with <redacted>.",
                },
                {
                  type: "server",
                  color: "text-tertiary",
                  desc: "Raw SMTP response lines from the server (e.g. 220 greeting, 250 EHLO response, 235 auth success, 221 bye).",
                },
                {
                  type: "info",
                  color: "text-tertiary-fixed-dim",
                  desc: "Internal state changes: connection established, TLS upgrade complete, authentication skipped, test complete.",
                },
                {
                  type: "error",
                  color: "text-error",
                  desc: "Failures at any stage: connection timeout, TLS error, auth rejected, server error response. The stream ends after the first error.",
                },
              ].map((item) => (
                <div key={item.type} className="flex gap-5 px-5 py-4 border-b border-outline-variant/10 last:border-0">
                  <code className={`${item.color} font-mono text-sm w-20 flex-shrink-0 pt-0.5 font-bold`}>
                    {item.type}
                  </code>
                  <span className="text-sm text-on-surface-variant">{item.desc}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-on-surface">Example stream</p>
              <CodeBlock>{`{"t":"2025-04-08T14:02:01.350Z","type":"info","line":"Connecting to smtp.gmail.com:587..."}
{"t":"2025-04-08T14:02:01.460Z","type":"info","line":"TCP connection established."}
{"t":"2025-04-08T14:02:01.461Z","type":"server","line":"220 smtp.gmail.com ESMTP k187sm5432103qkb.102"}
{"t":"2025-04-08T14:02:01.462Z","type":"client","line":"EHLO smtp8.local"}
{"t":"2025-04-08T14:02:01.520Z","type":"server","line":"250-smtp.gmail.com at your service"}
{"t":"2025-04-08T14:02:01.520Z","type":"server","line":"250-SIZE 35882577"}
{"t":"2025-04-08T14:02:01.520Z","type":"server","line":"250-STARTTLS"}
{"t":"2025-04-08T14:02:01.520Z","type":"server","line":"250 AUTH LOGIN PLAIN XOAUTH2"}
{"t":"2025-04-08T14:02:01.550Z","type":"client","line":"STARTTLS"}
{"t":"2025-04-08T14:02:01.620Z","type":"server","line":"220 2.0.0 Ready to start TLS"}
{"t":"2025-04-08T14:02:01.710Z","type":"info","line":"TLS upgrade complete."}
{"t":"2025-04-08T14:02:01.750Z","type":"info","line":"Attempting authentication..."}
{"t":"2025-04-08T14:02:01.752Z","type":"client","line":"AUTH PLAIN <redacted>"}
{"t":"2025-04-08T14:02:01.980Z","type":"server","line":"235 2.7.0 Accepted"}
{"t":"2025-04-08T14:02:01.981Z","type":"info","line":"Authentication succeeded."}
{"t":"2025-04-08T14:02:01.982Z","type":"client","line":"NOOP"}
{"t":"2025-04-08T14:02:02.040Z","type":"server","line":"250 2.0.0 OK"}
{"t":"2025-04-08T14:02:02.041Z","type":"client","line":"QUIT"}
{"t":"2025-04-08T14:02:02.100Z","type":"server","line":"221 2.0.0 closing connection"}
{"t":"2025-04-08T14:02:02.101Z","type":"info","line":"SMTP test complete."}`}</CodeBlock>
            </div>
          </Section>

          {/* Health */}
          <Section id="health" title="GET /health">
            <p className="text-sm">Returns the API health status. No rate limiting applied.</p>
            <CodeBlock>{`// Response 200
{ "ok": true, "ts": "2025-04-08T14:00:00.000Z" }`}</CodeBlock>
          </Section>

          {/* Code Examples */}
          <Section id="examples" title="Code Examples">
            <p className="text-sm font-semibold text-on-surface">cURL</p>
            <CodeBlock lang="bash">{`curl -N -X POST ${DISPLAY_URL}/v1/test \\
  -H "Content-Type: application/json" \\
  -d '{
    "host": "smtp.gmail.com",
    "port": 587,
    "encryption": "STARTTLS",
    "username": "you@gmail.com",
    "password": "your-app-password"
  }'`}</CodeBlock>

            <p className="text-sm font-semibold text-on-surface">JavaScript (browser / Node.js)</p>
            <CodeBlock lang="javascript">{`const response = await fetch("${DISPLAY_URL}/v1/test", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    host: "smtp.gmail.com",
    port: 587,
    encryption: "STARTTLS",
    username: "you@gmail.com",
    password: "your-app-password",
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  let idx = buffer.indexOf("\\n");
  while (idx !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line) {
      const event = JSON.parse(line);
      console.log(\`[\${event.type.toUpperCase()}] \${event.line}\`);
    }
    idx = buffer.indexOf("\\n");
  }
}`}</CodeBlock>

            <p className="text-sm font-semibold text-on-surface">Python</p>
            <CodeBlock lang="python">{`import httpx, json

with httpx.stream("POST", "${DISPLAY_URL}/v1/test",
    json={
        "host": "smtp.gmail.com",
        "port": 587,
        "encryption": "STARTTLS",
        "username": "you@gmail.com",
        "password": "your-app-password",
    }
) as r:
    for line in r.iter_lines():
        if line:
            event = json.loads(line)
            print(f"[{event['type'].upper()}] {event['line']}")`}</CodeBlock>
          </Section>

          <div className="pt-4 border-t border-outline-variant/10">
            <p className="text-sm text-on-surface-variant">
              Need usage guidance?{" "}
              <Link to="/docs" className="text-tertiary hover:underline">
                Read the documentation →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
