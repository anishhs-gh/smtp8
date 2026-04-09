# SMTP8 — Operations & Deployment Guide

This document is the single reference for cloning, running locally, configuring
environments, and deploying every component of SMTP8.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone & install](#2-clone--install)
3. [Environment setup](#3-environment-setup)
4. [Local development](#4-local-development)
5. [Running tests](#5-running-tests)
6. [First-time Firebase / GCP setup](#6-first-time-firebase--gcp-setup)
7. [Manual production deploy](#7-manual-production-deploy)
8. [GitHub Actions (CI/CD)](#8-github-actions-cicd)
9. [Updating the Cloud Run URL](#9-updating-the-cloud-run-url)
10. [CORS configuration](#10-cors-configuration)
11. [npm CLI publish](#11-npm-cli-publish)

---

## 1. Prerequisites

| Tool | Min version | Install |
|---|---|---|
| Node.js | 20 | https://nodejs.org |
| npm | 10 | bundled with Node |
| Firebase CLI | latest | `npm i -g firebase-tools` |
| Google Cloud CLI (`gcloud`) | latest | https://cloud.google.com/sdk |
| git | any | https://git-scm.com |

---

## 2. Clone & install

```bash
git clone https://github.com/anishhs-gh/smtp8.git
cd smtp8

# Install all three packages
npm ci --prefix backend
npm ci --prefix frontend
npm ci --prefix cli
```

---

## 3. Environment setup

### Backend (local dev)

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set PORT and ALLOWED_ORIGINS as needed
```

Default `backend/.env`:
```
PORT=8081
ALLOWED_ORIGINS=http://localhost:5173
```

In CI, `backend/.env.smtp8-ws` is written from the `ALLOWED_ORIGINS` secret
before `firebase deploy` — Firebase reads it by matching the project ID.

### Frontend (local dev)

```bash
cp frontend/.env.local.example frontend/.env.local
# VITE_API_BASE_URL=http://localhost:8081  (already set in the example)
```

**Production** (`frontend/.env.production`) is committed and requires no manual
setup. Vite auto-loads it during `vite build`, pointing the frontend at the
Cloud Run URL directly (bypassing Firebase Hosting's Fastly CDN which would
buffer the NDJSON stream).

### CLI

No env file required. The CLI defaults to the deployed Cloud Run API.
Override at runtime:

```bash
SMTP8_API_URL=https://api.example.com smtp8   # env var
smtp8 --api-url https://api.example.com       # flag (highest priority)
smtp8 --local                                  # shorthand for http://localhost:8081
```

---

## 4. Local development

Start backend and frontend in separate terminals:

```bash
# Terminal 1 — backend API (http://localhost:8081)
cd backend
npm run dev

# Terminal 2 — frontend dev server (http://localhost:5173)
cd frontend
npm run dev

# Or run CLI against local backend
cd cli
npm run dev -- --local
```

---

## 5. Running tests

```bash
# CLI tests (requires a build first)
cd cli
npm run build
npm test

# Backend build check
cd backend
npm run build

# Frontend build check
cd frontend
npm run build
```

Tests run automatically on every pull request via GitHub Actions (see
`.github/workflows/test.yml`).

---

## 6. First-time Firebase / GCP setup

### 6a. Log in and select project

```bash
firebase login
firebase use smtp8-ws
```

### 6b. Set hosting target

```bash
firebase target:apply hosting smtp8 smtp8
```

### 6c. Allow public invocations on the Cloud Function

After the first deploy, the Cloud Function requires an IAM binding so
unauthenticated requests are accepted:

```bash
gcloud functions add-invoker-policy-binding api \
  --project=smtp8-ws \
  --region=us-central1 \
  --member="allUsers"
```

This only needs to be run once (or after recreating the function).

### 6d. GitHub Secrets

Add these secrets in **Settings → Secrets and variables → Actions**:

| Secret | Example value | Used by |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | *(base64 JSON — see below)* | Firebase deploy auth |
| `FIREBASE_PROJECT_ID` | `smtp8-ws` | Firebase deploy |
| `VITE_API_BASE_URL` | `https://api-ne2iz2roeq-uc.a.run.app` | Frontend build |
| `ALLOWED_ORIGINS` | `https://smtp8.web.app,https://smtp8-ws.web.app` | Functions env file |
| `NPM_TOKEN` | *(npm automation token)* | npm publish |

All `.env.*` files are gitignored and exist locally only. CI writes them at
build time from these secrets — `VITE_API_BASE_URL` is injected as an env var
for `vite build`, and `ALLOWED_ORIGINS` is written to `backend/.env.smtp8-ws`
before `firebase deploy`.

To generate the service account key:

```bash
gcloud iam service-accounts create github-actions \
  --project=smtp8-ws \
  --display-name="GitHub Actions deploy"

gcloud projects add-iam-policy-binding smtp8-ws \
  --member="serviceAccount:github-actions@smtp8-ws.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"

gcloud iam service-accounts keys create /tmp/sa-key.json \
  --iam-account=github-actions@smtp8-ws.iam.gserviceaccount.com
```

The downloaded file is a JSON object like:

```json
{
  "type": "service_account",
  "project_id": "smtp8-ws",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "github-actions@smtp8-ws.iam.gserviceaccount.com",
  ...
}
```

Encode the whole file to a single base64 string and paste it as the secret:

```bash
# macOS — encodes and copies directly to clipboard
base64 -i /tmp/sa-key.json | pbcopy

# Linux
base64 -w 0 /tmp/sa-key.json
```

Paste the resulting single-line string as the `FIREBASE_SERVICE_ACCOUNT` secret
value. The `w9jds/firebase-action` Action decodes it internally before use.

```bash
rm /tmp/sa-key.json   # delete local copy after pasting
```

---

## 7. Manual production deploy

### Functions (backend)

```bash
cd backend
npm ci
npm run build
cd ..
firebase deploy --only functions --project smtp8-ws
```

### Hosting (frontend)

```bash
cd frontend
npm ci
npm run build    # picks up .env.production automatically
cd ..
firebase deploy --only hosting --project smtp8-ws
```

### Both at once

```bash
npm ci --prefix backend && npm run build --prefix backend
npm ci --prefix frontend && npm run build --prefix frontend
firebase deploy --project smtp8-ws
```

---

## 8. GitHub Actions (CI/CD)

### test.yml — runs on every PR and non-master push

- `test-backend`: `npm run build` in `backend/`
- `test-frontend`: `npm run build` in `frontend/`
- `test-cli`: `npm run build` then `npm test` in `cli/`

### deploy.yml — runs on merge to `master`

Uses `dorny/paths-filter` to deploy only the changed package:

| Changed path | Job triggered |
|---|---|
| `backend/**` or Firebase config | Deploy Firebase Functions |
| `frontend/**` or Firebase config | Deploy Firebase Hosting |
| `cli/**` | Publish to npm |

Each deploy job always runs `npm ci` + `npm run build` before deploying, since
`dist/` is gitignored and must be built fresh in CI.

---

## 9. Updating the Cloud Run URL

If the Cloud Run URL changes (e.g., after re-deploying to a new region or
project):

1. Update `frontend/.env.production`:
   ```
   VITE_API_BASE_URL=https://NEW-URL.a.run.app
   ```
2. Update `cli/src/index.ts` — the fallback in `main()`:
   ```ts
   "https://NEW-URL.a.run.app"
   ```
3. Update `backend/.env.smtp8-ws` if CORS origins also changed.
4. Commit and push — the deploy workflow will pick up the changes.

---

## 10. CORS configuration

Allowed origins are read from the `ALLOWED_ORIGINS` env var at startup.

### Local dev

Set in `backend/.env`:
```
ALLOWED_ORIGINS=http://localhost:5173
```

### Production (Firebase Functions)

Controlled via the `ALLOWED_ORIGINS` GitHub Secret. CI writes it to
`backend/.env.smtp8-ws` before deploying (Firebase loads the file matching the
project ID at deploy time). To add a custom domain, update the secret value in
GitHub and re-run the deploy workflow.

### Cloud Run (standalone)

Set the env var via the GCP console or CLI:

```bash
gcloud run services update api \
  --region=us-central1 \
  --project=smtp8-ws \
  --set-env-vars="ALLOWED_ORIGINS=https://smtp8.web.app,https://yourdomain.com"
```

---

## 11. npm CLI publish

The `.npmignore` ensures only the build output ships:

```
dist/
package.json
```

Manual publish:

```bash
cd cli
npm run build
npm publish --access public
```

Automated publish happens via the `deploy-cli` job in `deploy.yml` when
`cli/**` changes land on `master`. The `NPM_TOKEN` secret must be set (see
[§6d](#6d-github-secrets)).

To bump the version before publishing, update `VERSION` in `cli/src/index.ts`
and `version` in `cli/package.json` — they must match.
