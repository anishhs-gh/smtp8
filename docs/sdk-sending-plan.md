# smtp8 SDK — Email Sending Roadmap

A plan for evolving smtp8 from an SMTP **tester** into a full **sending SDK** (à la Nodemailer), while preserving and extending the security model already established in the tester.

---

## 1. What changes and what stays the same

### Stays the same
- The core SMTP protocol engine (`smtpTester.ts`) — connection, EHLO, STARTTLS upgrade, AUTH PLAIN / LOGIN, TLS cert validation
- The credential security model — credentials scoped locally, never logged, never serialised
- The event streaming model — same `ProtocolEvent` shape can be reused for send receipts and error traces

### What sending adds on top
| Concern | Testing | Sending SDK |
|---|---|---|
| Payload | None (NOOP + QUIT) | MIME message construction |
| Session lifecycle | One-shot | Connection pooling / reuse |
| Failure handling | Report and exit | Retry with backoff |
| Volume | Single test | Batch / queue |
| Attachments | N/A | Binary streaming |
| Authentication | Verify creds work | Creds must persist across sends |
| Deliverability | N/A | DKIM signing, envelope handling |

---

## 2. Proposed architecture

```
smtp8-sdk/
├── src/
│   ├── transport/
│   │   ├── connection.ts       # Raw socket + TLS lifecycle (evolved from smtpTester.ts)
│   │   ├── pool.ts             # Connection pool — acquire / release / health-check
│   │   └── auth.ts             # AUTH PLAIN, AUTH LOGIN, AUTH XOAUTH2
│   ├── message/
│   │   ├── builder.ts          # MIME multipart builder
│   │   ├── headers.ts          # Header folding, encoding (RFC 5322)
│   │   ├── address.ts          # RFC 5321 address parsing and validation
│   │   └── dkim.ts             # DKIM-Signature header generation
│   ├── send.ts                 # Public `send()` entry point
│   ├── types.ts                # Public-facing types (Message, SendOptions, SendResult)
│   └── errors.ts               # Typed error hierarchy
└── index.ts                    # Package exports
```

---

## 3. Security — same model, harder problems

### 3.1 Credential handling

The tester already clears credentials from the request object immediately after capture. The SDK must go further because credentials need to survive across multiple sends (connection pool reuse).

- Store credentials in a dedicated `Credentials` object with a `dispose()` method — call it explicitly on pool teardown
- Never serialise credentials to disk (no config file caching, no JSON logging)
- Do not include credentials in `Error.message`, stack traces, or any `SendResult` fields — same `sanitizeErrorMessage()` guard already in the tester
- Accept credentials as a factory function `() => Promise<{ username: string; password: string }>` so callers can pull from a secrets manager at runtime rather than passing raw strings

```ts
// Preferred API
const transport = createTransport({
  host: "smtp.example.com",
  port: 587,
  encryption: "STARTTLS",
  credentials: async () => ({
    username: await vault.get("SMTP_USER"),
    password: await vault.get("SMTP_PASS"),
  }),
});
```

### 3.2 MIME injection prevention

Nodemailer has historically had issues with header injection. Every user-supplied string that lands in an email header (From, To, Subject, custom headers) must be validated and folded:

- Reject any value containing bare `\r` or `\n` — these are MIME header injection vectors
- Encode non-ASCII header values with RFC 2047 `=?UTF-8?B?...?=` encoding
- Validate RFC 5321 addresses (local-part@domain) before putting them in the RCPT TO envelope — not just the header `To:` field
- Strip or reject the `Bcc:` header from the transmitted message body (it must only appear in the envelope, never the DATA payload)

### 3.3 TLS

- Keep `rejectUnauthorized: true` as the hardcoded default — no opt-out
- Expose `tlsOptions` for passing a custom CA bundle (enterprise internal CAs), but never expose a way to disable verification entirely
- Log the negotiated TLS version and cipher in `SendResult.trace` so callers can audit

### 3.4 DKIM signing

- Private keys must never be logged or included in any error output
- Accept the key as a `Buffer` or async factory — not a file path (file path APIs invite accidental logging of the path and make key rotation harder)
- Sign only after the full message is assembled — sign the final byte sequence, not an intermediate representation

### 3.5 Rate limiting and abuse surface

The tester has server-side rate limiting. The SDK is client-side, so rate limiting becomes the caller's responsibility — but the SDK should make it easy:

- Expose a `maxConnectionsPerHost` and `maxSendsPerSecond` option on the pool
- Emit a `rate-limit` event when the server returns `421` or `450` so callers can back off

---

## 4. Reliability

### 4.1 Connection pool

A single SMTP connection can send many messages in one session (RSET between sends). Pooling avoids the TCP + TLS + EHLO + AUTH round-trips on every send.

```
pool.acquire()
  → reuse idle connection if healthy (NOOP ping)
  → or open a new one up to maxConnections
  → or queue the request if at capacity

pool.release(conn)
  → mark idle, start idle-timeout timer
  → destroy if server closed or timer fires
```

Key decisions:
- Health-check idle connections with NOOP before handing them out (same NOOP already in the tester flow)
- Destroy connections that have been idle longer than `idleTimeoutMs` — servers close idle connections silently
- Hard cap on pool size per host to prevent accidental flooding

### 4.2 Retry with backoff

Transient failures (network blip, `421 Service temporarily unavailable`) should be retried. Permanent failures (`5xx`) should not.

```
retry policy:
  - retryable: connection errors, 421, 450, 451
  - not retryable: 5xx, AUTH failures, message rejection (550, 551, 553)
  - max retries: 3 (configurable)
  - backoff: exponential with jitter — 1s, 2–4s, 4–8s
```

### 4.3 Envelope vs. message distinction

SMTP has two separate address sets:
- **Envelope** — `MAIL FROM` and `RCPT TO` commands (what the server actually routes on)
- **Message headers** — `From:`, `To:`, `Cc:` (what the recipient's client displays)

These can differ (e.g. mailing lists, BCC). The SDK must expose both independently, with the envelope derived from headers as the default but overridable.

### 4.4 Large attachment streaming

Do not buffer entire attachments in memory. The MIME builder should accept `Readable` streams and pipe them through base64 encoding directly to the socket.

---

## 5. Public API sketch

```ts
import { createTransport } from "smtp8";

const transport = createTransport({
  host: "smtp.example.com",
  port: 587,
  encryption: "STARTTLS",       // "STARTTLS" | "SSL_TLS" | "NONE"
  credentials: {
    username: "user@example.com",
    password: process.env.SMTP_PASS,   // or async factory
  },
  pool: {
    maxConnections: 5,
    idleTimeoutMs: 30_000,
  },
  dkim: {
    domain: "example.com",
    selector: "smtp8",
    privateKey: Buffer.from(process.env.DKIM_KEY, "base64"),
  },
});

const result = await transport.send({
  from: { name: "Alice", address: "alice@example.com" },
  to: [{ address: "bob@example.com" }],
  subject: "Hello",
  text: "Plain text body",
  html: "<p>HTML body</p>",
  attachments: [
    { filename: "report.pdf", content: fs.createReadStream("report.pdf") },
  ],
});

// result.messageId  — generated Message-ID header
// result.accepted   — addresses accepted by the server
// result.rejected   — addresses rejected (with per-address error)
// result.trace      — ProtocolEvent[] — the full protocol exchange

await transport.close(); // drain pool and close connections
```

---

## 6. What to reuse from the current codebase

| Current code | Reuse as |
|---|---|
| `smtpTester.ts` — `createLineReader` | Core of `connection.ts` — unchanged |
| `smtpTester.ts` — `withTimeout` | Unchanged, move to `connection.ts` |
| `smtpTester.ts` — `parseAuthMethods` | Unchanged |
| `smtpTester.ts` — `sendLine` / `readResponse` | Unchanged |
| `smtpTester.ts` — `sanitizeErrorMessage` | Extend to cover MIME fields too |
| `smtpTester.ts` — `ProtocolEvent` type | Reuse for `SendResult.trace` |
| CLI `printEvent()` | Reuse for `smtp8 send` CLI command |

The tester's protocol core is essentially the foundation of the sending transport. The main additions are above the socket layer (MIME, pooling, retry) and the DKIM layer below the socket.

---

## 7. What not to do (lessons from Nodemailer)

- **Do not support `sendmail` transport or shell exec** — command injection risk
- **Do not have a "direct" mode that skips TLS verification** — once it exists, it gets used
- **Do not auto-generate a Message-ID that leaks the hostname** — use a UUID + configured domain
- **Do not accept raw `headers` objects without sanitisation** — injection vector
- **Do not log the full DATA payload** — sensitive content ends up in log aggregators
- **Do not buffer attachments in memory** — OOM on large files

---

## 8. Packaging

- Keep the tester CLI (`smtp8` binary) and the SDK (`smtp8` Node module) in the same package — `smtp8 test` and `smtp8 send` as CLI commands, `import { createTransport } from "smtp8"` for programmatic use
- All Node built-ins (`net`, `tls`, `crypto` for DKIM) — zero runtime dependencies remains achievable
- Export TypeScript types — the current codebase is already fully typed
