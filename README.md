# SMTP8

Test any SMTP server in real time — straight from your browser or terminal.

SMTP8 connects directly to an SMTP server, streams every protocol event as it happens, and tells you exactly what failed and why. No credentials are stored or logged.

**Live app** → [smtp8.web.app](https://smtp8.web.app)

---

## What it does

- TCP/TLS connection → EHLO → optional STARTTLS upgrade → optional AUTH → NOOP → QUIT
- Every step streamed live as Server-Sent Events — each protocol round-trip appears as it happens
- Supports STARTTLS (port 587), SSL/TLS (port 465), and plain (port 25)
- Credentials redacted in all logs

---

## Packages

| Package | Description |
|---|---|
| `frontend/` | React + Vite web app — live step tracker and raw protocol inspector |
| `backend/` | Express API — runs the SMTP session, streams events over SSE |
| `cli/` | `smtp8` npm CLI — same test, directly from your terminal (no backend required) |

---

## CLI

```bash
npm install -g smtp8
smtp8
```

Runs the SMTP test directly from your machine by default — no backend needed. Options:

```
--remote          Route through the hosted smtp8 API instead
--api-url <url>   Route through a custom API URL
--version, -v     Print version
--help, -h        Show help
```

Non-interactive mode for scripts and CI:

```bash
smtp8 test --host smtp.gmail.com
smtp8 test --host smtp.gmail.com --port 465 --encryption SSL_TLS
SMTP8_PASSWORD=secret smtp8 test --host smtp.gmail.com --username user@gmail.com
```

See [`cli/README.md`](cli/README.md) for full usage.

---

## Local development

**Prerequisites:** Node 20+, npm 10+

```bash
git clone https://github.com/anishhs-gh/smtp8.git
cd smtp8

# Install all packages
npm ci --prefix backend
npm ci --prefix frontend
npm ci --prefix cli

# Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Start backend and frontend in separate terminals:

```bash
# Terminal 1 — API on http://localhost:8081
cd backend && npm run dev

# Terminal 2 — UI on http://localhost:5173
cd frontend && npm run dev

# CLI — runs directly from your machine, no backend needed
smtp8
```

---

## Building

```bash
cd backend && npm run build   # TypeScript → dist/
cd frontend && npm run build  # Vite → dist/
cd cli && npm run build       # esbuild bundle → dist/index.js
```

---

## Tests

```bash
cd cli && npm test   # 9 tests, all passing
```

Tests run automatically on every pull request via GitHub Actions.

---

## Deployment

- **Frontend** — Firebase Hosting
- **Backend** — standalone Cloud Run service via Docker (no Firebase Functions wrapper — required for SSE streaming to work)
- **CLI** — published to npm on version bump

See [`docs/ops-guide.md`](docs/ops-guide.md) for full setup, secrets, and deploy commands.

---

## Architecture

```
Browser / CLI
     │
     │  POST /v1/test  (SSE stream)
     ▼
Cloud Run — standalone Express container    ← backend/
     │
     │  raw TCP / TLS
     ▼
SMTP server (Gmail, SendGrid, etc.)
```

The backend runs as a plain Docker container on Cloud Run, without the Firebase Functions wrapper. The Functions framework buffers the full response before forwarding, so all events arrive at once. Standalone Cloud Run streams each SSE event as the SMTP protocol round-trip completes, confirmed by per-event client-side timestamps spanning the real SMTP session duration.

---

## Docs

- [`docs/ops-guide.md`](docs/ops-guide.md) — local setup, deploy, secrets, CORS config
- [`docs/deployment.md`](docs/deployment.md) — hosting options and architecture notes
- [`docs/streaming-fix-plan.md`](docs/streaming-fix-plan.md) — why streaming failed through Firebase Functions and how it was fixed
- [`docs/sdk-sending-plan.md`](docs/sdk-sending-plan.md) — roadmap for evolving into an email-sending SDK

---

## License

MIT
