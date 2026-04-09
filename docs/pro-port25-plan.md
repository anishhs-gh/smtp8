# Pro Feature Plan — Port 25 / Internal Relay Testing

## What this is

A future **Pro tier** capability that allows testing **bare internal SMTP relays** —
servers that accept unauthenticated connections on port 25 from within a private
network. This is an infrastructure debugging tool for DevOps / sysadmin users, not
relevant to standard authenticated ESP testing.

### Scenarios this unlocks

| Scenario | Example |
|---|---|
| Corporate internal relay | Postfix/Sendmail configured as an open relay for internal subnets |
| Legacy application mail | ERP, CRM, monitoring systems (Nagios, Zabbix) that only speak port 25 |
| Self-hosted mail server | Testing a Postfix/Exim instance before it goes live |
| Dev mail catchers | Mailhog, Mailtrap self-hosted, smtp4dev running on port 25 |

In all these cases the user would set **Port = 25**, **Encryption = None**, and
leave username/password blank. The current code already supports this flow — the
only thing blocking it is the cloud provider's network policy.

---

## Why it needs a VPS

Port 25 outbound is blocked at the **network level** on Google Cloud (and AWS by
default). This is not a software limit — no code change fixes it. The only path
is hosting the API on infrastructure where port 25 egress is open:

- Hetzner VPS (CX11, ~€3.79/mo) — open by default
- DigitalOcean Droplet — open after account verification
- Fly.io — open, generous free tier
- Any bare-metal or dedicated server

The Pro API would run on a VPS alongside (or instead of) the Cloud Functions
instance. Everything else — frontend, CLI — stays the same.

---

## Code changes required

There are **two small, fully reversible changes** needed in the backend to support
both Cloud Functions (free tier) and VPS (Pro) from the same codebase.

### Change 1 — Guard `app.listen` behind an env flag

**Current `src/server.ts` (last two lines):**

```ts
app.listen(port, () => {
  console.log(`SMTP tester backend listening on :${port}`);
});
```

**Change to:**

```ts
// Export for Firebase Functions / Cloud Functions (they provide their own HTTP server)
export { app };

// Only bind a port when running standalone (local dev or VPS)
// Cloud Functions sets K_SERVICE; Firebase Functions sets FUNCTION_TARGET
if (!process.env.K_SERVICE && !process.env.FUNCTION_TARGET) {
  app.listen(port, () => {
    console.log(`SMTP8 API listening on :${port}`);
  });
}
```

**Why:** Cloud Functions and Firebase Functions inject the HTTP server themselves —
they call your exported `app` directly. If `app.listen` is unconditional, the
function crashes on startup trying to bind a port that's already managed by the
runtime. The `K_SERVICE` env var is set automatically by Cloud Run / Cloud Functions
2nd gen; `FUNCTION_TARGET` is set by Firebase Functions.

**To revert:** Delete the `export { app }` line and remove the `if` guard — restore
the bare `app.listen(...)` call.

---

### Change 2 — Add a Firebase Functions entry point file

Cloud Functions / Firebase Functions need a specific file to import from. Create
`src/index.ts` (new file, does not touch `server.ts`):

```ts
// src/index.ts — Firebase Functions / Cloud Functions entry point
// This file is ONLY used when deploying to Functions.
// For VPS or local dev, server.ts is the entry point.
import { onRequest } from "firebase-functions/v2/https";
import { app } from "./server.js";

export const api = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 60,
    cors: false, // CORS is handled inside the Express app
  },
  app
);
```

**To revert:** Delete `src/index.ts`. Nothing in `server.ts` depends on it.

---

### Change 3 — Add Firebase Functions dependencies (only when deploying to Functions)

```bash
cd backend
npm install firebase-functions firebase-admin
npm install --save-dev firebase-functions-test
```

Update `backend/package.json` engines field:

```json
"engines": { "node": "20" }
```

**To revert:** `npm uninstall firebase-functions firebase-admin firebase-functions-test`
and remove the engines field.

---

### Summary of changes

| File | Change | Reversible? |
|---|---|---|
| `src/server.ts` | Guard `app.listen`, add `export { app }` | Yes — 3 lines |
| `src/index.ts` | New file, Functions entry point | Yes — delete the file |
| `package.json` | Add firebase-functions deps | Yes — uninstall |

No changes to `smtpTester.ts`, `types.ts`, middleware, rate limiting, or any
business logic. The actual SMTP test code is identical across both deployments.

---

## Deployment architecture (Pro)

```
Free tier                          Pro tier
─────────────────────────────────  ─────────────────────────────────
Firebase Hosting (frontend)        Firebase Hosting (frontend) ← same
Firebase Functions (API)           VPS nginx → Express (API)
  ports 587, 465 only                ports 587, 465, 25 ✓
```

The frontend would need an env var pointing to the Pro API URL. The simplest
approach is a single `VITE_API_BASE_URL` swap at build time — no frontend code
changes required.

---

## Can Firebase deploy both hosting and the API?

**Yes — and this is the recommended approach for the free tier.**

Firebase can deploy hosting and Cloud Functions in a single project with a single
command:

```
firebase deploy
```

This deploys:
- `frontend/dist` → Firebase Hosting
- `src/index.ts` export → Firebase Functions (Cloud Functions 2nd gen under the hood)

The Firebase Functions URL looks like:
`https://us-central1-YOUR_PROJECT.cloudfunctions.net/api`

You can also map it to a clean path using Firebase Hosting rewrites so the frontend
calls `https://your-project.web.app/api/v1/test` and Firebase proxies it to the
function — no CORS issue, same origin:

```json
// firebase.json
{
  "hosting": {
    "public": "frontend/dist",
    "rewrites": [
      { "source": "/api/**", "function": "api", "region": "us-central1" },
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "functions": {
    "source": "backend",
    "codebase": "smtp8-api",
    "ignore": ["node_modules", "src", ".git"]
  }
}
```

With this setup `VITE_API_BASE_URL` becomes just `/api` (relative) and the whole
product deploys with one command from the repo root.

---

## Recommended rollout

1. **Now (free tier):** Deploy with Cloud Functions via Firebase using the two
   code changes above. All standard SMTP testing (ports 587/465) works. Zero
   infrastructure cost at low traffic.

2. **Later (Pro tier):** Spin up a Hetzner CX11 VPS, deploy the same Express
   server with PM2 + nginx, point a subdomain at it (e.g. `pro-api.smtp8.dev`).
   Revert the two code changes in `server.ts` for the VPS build — it runs
   standalone again. Frontend Pro plan users get `VITE_API_BASE_URL` pointed at
   the VPS.

3. **Both tiers run simultaneously** — free users hit Firebase Functions
   (587/465 only), Pro users hit the VPS (587/465/25). Same codebase, different
   deployment targets.
