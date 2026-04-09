# Local Development (Emulators First)

## Prereqs
- Node.js 18+.
- Firebase CLI installed (`npm i -g firebase-tools`).

## Frontend
1. `cd frontend`
2. `cp .env.local.example .env.local` and adjust if needed.
3. `npm install`
4. `npm run dev`

## Backend
1. `cd backend`
2. `npm install`
3. `npm run dev`

## Firebase Hosting Emulator
1. `cd frontend`
2. `npm run build`
3. `cd ..`
4. `firebase emulators:start --only hosting`

Frontend will be available at `http://127.0.0.1:5001` and will call the local backend at `http://localhost:8081` via `VITE_API_BASE_URL`.
