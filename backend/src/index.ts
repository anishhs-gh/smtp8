/**
 * Firebase Functions / Cloud Functions entry point.
 *
 * This file is ONLY used when deploying to Firebase Functions.
 * For local dev, VPS, or Cloud Run, `server.ts` is the entry point
 * and `app.listen` runs directly.
 *
 * To revert to standalone-only: delete this file. Nothing in server.ts
 * depends on it.
 */
import { onRequest } from "firebase-functions/v2/https";
import { app } from "./server.js";

export const api = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 60,
    // CORS is handled inside the Express app — do not let Functions add its own.
    cors: false,
  },
  app
);
