# SMTP8 — Setup & Deployment Checklist

## Code changes

- [x] Guard `app.listen` in `backend/src/server.ts` behind `K_SERVICE` / `FUNCTION_TARGET` env check
- [x] Export `app` from `backend/src/server.ts` for Firebase Functions entry point
- [x] Create `backend/src/index.ts` — Firebase Functions / Cloud Functions entry point

## Environment files

- [x] Create `backend/.env.example`
- [x] Create `frontend/.env.example`
- [x] Create `cli/.env.example`

## Firebase configuration

- [x] Update `firebase.json` — added `functions` block, `/api/**` rewrite, SPA `**` rewrite
- [x] Add `functions` emulator to `firebase.json`
- [x] Update `backend/package.json` — added `main`, `engines: node 20`, renamed to `smtp8-api`
- [x] Install `firebase-functions` and `firebase-admin` in backend
- [ ] Update `.firebaserc` — replace `smtp-tester-local` with your real Firebase project ID

## Repository setup

- [x] Create root `.gitignore`
- [x] Create `cli/.npmignore`
- [x] Create `.github/CODEOWNERS` (`* @anishhs-gh`)
- [x] Initialize git (`git init`)
- [x] Initial commit on `master`

## GitHub Actions

- [x] `.github/workflows/test.yml` — build check on every push/PR (not master)
- [x] `.github/workflows/deploy.yml` — master only, change-detection per package

### Deploy change-detection rules (active)

| Files changed | Job triggered |
|---|---|
| `backend/**` | Deploy Firebase Functions |
| `frontend/**` | Deploy Firebase Hosting |
| `cli/**` | Publish to npm |
| `firebase.json` or `.firebaserc` | Deploy both hosting + functions |

## GitHub Secrets to configure (after pushing to GitHub)

- [ ] `FIREBASE_SERVICE_ACCOUNT` — service account JSON (Firebase console → Project settings → Service accounts)
- [ ] `FIREBASE_PROJECT_ID` — your Firebase project ID (e.g. `smtp8-prod`)
- [ ] `NPM_TOKEN` — npm automation token (`npm token create --type=automation`)

## Real values to fill in

- [ ] `.firebaserc` → replace `smtp-tester-local` with real Firebase project ID
- [ ] `backend/.env` (production) → set `ALLOWED_ORIGINS` to your Firebase Hosting URL
- [ ] Confirm `smtp8` package name is available on npmjs.com before first publish

## Post-deploy smoke tests

- [ ] Open Firebase Hosting URL — confirm SMTP8 loads
- [ ] Run a test against `smtp.gmail.com:587` — confirm live streaming works end-to-end
- [ ] Visit `/does-not-exist` — confirm 404 page renders (SPA rewrite working)
- [ ] `npm install -g smtp8 && smtp8 --version` — confirm CLI installs from npm
- [ ] `smtp8` with `SMTP8_API_URL` pointing at production — confirm live test works from CLI
