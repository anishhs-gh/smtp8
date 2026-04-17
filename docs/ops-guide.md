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
6. [First-time GCP / Firebase setup](#6-first-time-gcp--firebase-setup)
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
| Docker | any | https://www.docker.com |
| Firebase CLI | latest | `npm i -g firebase-tools` |
| Google Cloud CLI (`gcloud`) | latest | https://cloud.google.com/sdk |
| git | any | https://git-scm.com |

Docker is only needed when building and pushing the backend image for deployment.
It is not required for local development.

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

### Frontend (local dev)

```bash
cp frontend/.env.local.example frontend/.env.local
# VITE_API_BASE_URL=http://localhost:8081  (already set in the example)
```

In production, `VITE_API_BASE_URL` is injected at build time via the GitHub
Secret of the same name, pointing the frontend at the Cloud Run service URL.

### CLI

No env file required. The CLI runs SMTP tests directly from your machine by
default — no backend needed. Override at runtime:

```bash
SMTP8_API_URL=https://api.example.com smtp8   # env var
smtp8 --api-url https://api.example.com       # flag (highest priority)
smtp8 --remote                                # use the hosted smtp8 API
```

---

## 4. Local development

Start backend and frontend in separate terminals:

```bash
# Terminal 1 — backend API (http://localhost:8081)
cd backend && npm run dev

# Terminal 2 — frontend dev server (http://localhost:5173)
cd frontend && npm run dev

# CLI — runs directly from your machine, no backend needed
smtp8

# CLI against local backend
smtp8 --api-url http://localhost:8081
```

---

## 5. Running tests

```bash
# CLI unit tests
cd cli && npm run build && npm test

# Backend TypeScript check
cd backend && npm run build

# Frontend build check
cd frontend && npm run build
```

All 9 CLI tests pass. Tests run automatically on every pull request via
GitHub Actions (`.github/workflows/test.yml`).

---

## 6. First-time GCP / Firebase setup

### 6a. Log in

```bash
firebase login
gcloud auth login
gcloud config set project smtp8-ws
```

### 6b. Set Firebase hosting target

```bash
firebase use smtp8-ws
firebase target:apply hosting smtp8 smtp8
```

### 6c. Create Artifact Registry repository

Docker images for the backend are stored here. Run once:

```bash
gcloud artifacts repositories create smtp8-standalone \
  --repository-format=docker \
  --location=us-central1 \
  --project=smtp8-ws
```

### 6d. GitHub Secrets

Add these in **Settings → Secrets and variables → Actions**:

| Secret | Value | Used by |
|---|---|---|
| `GCP_SA_KEY` | Service account JSON (see below) | Cloud Run deploy |
| `GCP_PROJECT_ID` | `smtp8-ws` | Cloud Run deploy |
| `VITE_API_BASE_URL` | `https://<cloud-run-url>.run.app` | Frontend build |
| `ALLOWED_ORIGINS` | `https://smtp8.web.app,https://smtp8-ws.web.app` | Backend CORS |
| `FIREBASE_TOKEN` | Firebase CI token | Hosting deploy |
| `FIREBASE_PROJECT_ID` | `smtp8-ws` | Hosting deploy |
| `NPM_TOKEN` | npm automation token | CLI publish |

#### Creating the GCP service account

```bash
gcloud iam service-accounts create github-actions \
  --project=smtp8-ws \
  --display-name="GitHub Actions deploy"

for role in roles/run.admin roles/artifactregistry.writer roles/storage.admin roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding smtp8-ws \
    --member="serviceAccount:github-actions@smtp8-ws.iam.gserviceaccount.com" \
    --role="$role"
done

gcloud iam service-accounts keys create /tmp/sa-key.json \
  --iam-account=github-actions@smtp8-ws.iam.gserviceaccount.com
```

Paste the contents of `/tmp/sa-key.json` as the `GCP_SA_KEY` secret value (raw
JSON, no base64 encoding). Then delete the local copy:

```bash
rm /tmp/sa-key.json
```

#### Firebase CI token

```bash
firebase login:ci
```

Copy the printed token and save it as the `FIREBASE_TOKEN` secret.

---

## 7. Manual production deploy

### Backend (Cloud Run)

```bash
cd backend

docker build --platform linux/amd64 \
  -t us-central1-docker.pkg.dev/smtp8-ws/smtp8-standalone/smtp8-api:latest .

gcloud auth configure-docker us-central1-docker.pkg.dev
docker push us-central1-docker.pkg.dev/smtp8-ws/smtp8-standalone/smtp8-api:latest

gcloud run deploy api \
  --image us-central1-docker.pkg.dev/smtp8-ws/smtp8-standalone/smtp8-api:latest \
  --region us-central1 \
  --project smtp8-ws \
  --allow-unauthenticated \
  --set-env-vars "^|^ALLOWED_ORIGINS=https://smtp8.web.app,https://smtp8-ws.web.app" \
  --memory 512Mi \
  --timeout 60 \
  --no-use-http2
```

`--no-use-http2` is required. With HTTP/2 end-to-end, the Cloud Run GFE batches
SSE DATA frames and the stream arrives all at once instead of incrementally.

### Frontend (Firebase Hosting)

```bash
cd frontend
VITE_API_BASE_URL=https://<cloud-run-url>.run.app npm run build
cd ..
firebase deploy --only hosting --project smtp8-ws
```

---

## 8. GitHub Actions (CI/CD)

### test.yml — runs on every PR and non-master push

- `test-backend`: TypeScript build check
- `test-frontend`: Vite build check
- `test-cli`: build + `npm test`

### deploy.yml — runs on merge to `master`

Uses `dorny/paths-filter` to deploy only changed packages:

| Changed path | Job triggered |
|---|---|
| `backend/**` (src, package, tsconfig, Dockerfile) | Build Docker image → deploy to Cloud Run |
| `frontend/**` or `firebase.json` / `.firebaserc` | Vite build → deploy to Firebase Hosting |
| `cli/**` | Build → publish to npm (if version not yet published) |

---

## 9. Updating the Cloud Run URL

If the service URL changes:

1. Update the `VITE_API_BASE_URL` GitHub Secret.
2. Update `HOSTED_API_URL` in `cli/src/index.ts`.
3. Update `ALLOWED_ORIGINS` if the frontend domain also changed.
4. Commit and push — CI redeploys both frontend and backend.

---

## 10. CORS configuration

Allowed origins are read from the `ALLOWED_ORIGINS` env var at startup.

### Local dev

`backend/.env`:
```
ALLOWED_ORIGINS=http://localhost:5173
```

### Production

Controlled via the `ALLOWED_ORIGINS` GitHub Secret. To add a domain without a
full redeploy:

```bash
gcloud run services update api \
  --region=us-central1 \
  --project=smtp8-ws \
  --set-env-vars "^|^ALLOWED_ORIGINS=https://smtp8.web.app,https://yourdomain.com"
```

---

## 11. npm CLI publish

Manual publish:

```bash
cd cli && npm run build && npm publish --access public
```

CI publishes automatically when `cli/**` changes reach `master`, skipping if
the current `package.json` version is already on the registry. To release a new
version, bump `version` in `cli/package.json` and `VERSION` in
`cli/src/index.ts` — they must match.
