# SMTP8

Test any SMTP server in real time — straight from your browser or terminal.

SMTP8 connects directly to an SMTP server, streams every protocol event as it happens, and tells you exactly what failed and why. No credentials are stored or logged.

**Live app** → [smtp8.web.app](https://smtp8.web.app)

---

## What it does

- TCP/TLS connection → EHLO → optional STARTTLS upgrade → optional AUTH → NOOP → QUIT
- Every step streamed live as NDJSON — no waiting for the full session to complete
- Supports STARTTLS (port 587), SSL/TLS (port 465), and plain (port 25)
- Credentials redacted in all logs

---

## Packages

| Package | Description |
|---|---|
| `frontend/` | React + Vite web app — live step tracker and raw protocol inspector |
| `backend/` | Express API — runs the SMTP session, streams events |
| `cli/` | `smtp8` npm CLI — same test, from your terminal |

---

## CLI

```bash
npm install -g smtp8
smtp8
```

Uses the deployed API by default. Options:

```
--local           Point at http://localhost:8081 (local dev)
--api-url <url>   Custom API URL
--version, -v     Print version
--help, -h        Show help
```

Navigation inside prompts: **Tab** to autofill the placeholder, **Ctrl+C** to go back, **ESC** to clear the current field.

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

# Or use the CLI against local backend
cd cli && npm run dev -- --local
```

---

## Running tests

```bash
cd cli
npm run build
npm test
```

Tests run automatically on every pull request via GitHub Actions.

---

## Deployment

Deployed via Firebase Hosting (frontend) and Firebase Functions (backend). See [`docs/ops-guide.md`](docs/ops-guide.md) for the full setup, environment config, GitHub Secrets, and deploy commands.

---

## Docs

- [`docs/ops-guide.md`](docs/ops-guide.md) — local setup, deploy, secrets, CORS config
- [`docs/deployment.md`](docs/deployment.md) — hosting options (Cloud Functions, Cloud Run, VPS)
- [`docs/setup-checklist.md`](docs/setup-checklist.md) — first-time setup checklist
- [`docs/pro-port25-plan.md`](docs/pro-port25-plan.md) — future port 25 / VPS plan

---

## Architecture

```
Browser / CLI
     │
     │  POST /v1/test  (NDJSON stream)
     ▼
Firebase Functions (Express)          ← backend/
     │
     │  raw TCP / TLS
     ▼
SMTP server (Gmail, SendGrid, etc.)
```

The frontend calls the Cloud Run URL directly — bypassing Firebase Hosting's CDN — so the NDJSON stream reaches the browser without buffering.

---

## License

MIT
