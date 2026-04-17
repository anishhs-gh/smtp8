import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { runSmtpTest } from "./smtpTester";
import { SmtpTestRequest } from "./types";

const app = express();
const port = Number(process.env.PORT ?? 8081);

// Trust the first proxy hop (Cloud Run / Firebase Functions load balancer).
// Required so req.ip returns the real client IP from X-Forwarded-For,
// which express-rate-limit uses to key rate limit buckets.
app.set("trust proxy", 1);

// ─── Security headers ────────────────────────────────────────────────────────
// This is a JSON API server, not an HTML app, so we disable HTML-specific
// protections and focus on transport security.
app.use(
  helmet({
    contentSecurityPolicy: false,       // not serving HTML
    crossOriginEmbedderPolicy: false,   // not serving HTML
    hsts: {
      maxAge: 31536000,                 // 1 year
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,                      // X-Content-Type-Options: nosniff
    referrerPolicy: { policy: "no-referrer" },
  })
);

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin not allowed — ${origin}`));
      }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(
  express.json({
    limit: "8kb",
    strict: true,
    type: ["application/json", "application/*+json"],
  })
);

// ─── Rate limiting ────────────────────────────────────────────────────────────
// validate.trustProxy: false — we set trust proxy above so express-rate-limit
// should not re-warn about X-Forwarded-For being present.
// Global guard: 120 req / 15 min per IP across all endpoints
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: "Too many requests. Please slow down." },
  })
);

// Tight limit on the test endpoint: 10 tests / 60 s per IP
const testLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    error: "Rate limit exceeded. You may run at most 10 tests per minute.",
  },
});

// ─── Router ───────────────────────────────────────────────────────────────────
// All routes are mounted on a Router so they work at both:
//   /health      (local dev / Cloud Run direct access)
//   /api/health  (Firebase Hosting rewrite passes the full /api/* path)
const router = express.Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

// ─── Validation helpers ───────────────────────────────────────────────────────
// RFC-1123 hostname labels: letters, digits, hyphens; dots as separators
const HOSTNAME_RE =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

const isValidHost = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 255 && HOSTNAME_RE.test(v);

const isValidPort = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0 && v < 65536;

const isValidEncryption = (v: unknown): v is string =>
  v === "NONE" || v === "STARTTLS" || v === "SSL_TLS";

const normalizeRequest = (body: unknown): SmtpTestRequest => {
  if (!body || typeof body !== "object") throw new Error("Invalid JSON body.");

  const b = body as Record<string, unknown>;

  if (!isValidHost(b.host)) {
    throw new Error(
      "Invalid host. Provide a valid hostname (e.g. smtp.provider.com)."
    );
  }
  if (!isValidPort(b.port)) {
    throw new Error("Invalid port. Must be an integer between 1 and 65535.");
  }
  if (!isValidEncryption(b.encryption)) {
    throw new Error("Invalid encryption. Must be NONE, STARTTLS, or SSL_TLS.");
  }

  const assertOptionalString = (
    field: string,
    maxLen: number
  ): string | undefined => {
    const val = b[field];
    if (val === undefined || val === null) return undefined;
    if (typeof val !== "string") throw new Error(`Invalid ${field}.`);
    if (val.length > maxLen)
      throw new Error(`${field} exceeds maximum length of ${maxLen}.`);
    return val;
  };

  const username = assertOptionalString("username", 320);
  const password = assertOptionalString("password", 1024);
  const clientName = assertOptionalString("clientName", 255);

  const timeoutMs = b.timeoutMs;
  if (
    timeoutMs !== undefined &&
    timeoutMs !== null &&
    (typeof timeoutMs !== "number" ||
      !Number.isInteger(timeoutMs) ||
      timeoutMs <= 0 ||
      timeoutMs > 60000)
  ) {
    throw new Error("Invalid timeoutMs. Must be an integer between 1 and 60000.");
  }

  return {
    host: b.host as string,
    port: b.port as number,
    encryption: b.encryption as SmtpTestRequest["encryption"],
    username,
    password,
    clientName,
    timeoutMs: timeoutMs as number | undefined,
  };
};

// ─── SMTP test endpoint ───────────────────────────────────────────────────────
router.post("/v1/test", testLimiter, async (req, res) => {
  let payload: SmtpTestRequest;

  try {
    payload = normalizeRequest(req.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";
    return res.status(400).json({ error: message });
  } finally {
    // Drop credential fields from the raw parsed body immediately after
    // extraction. `payload` now holds the only live references.
    if (req.body && typeof req.body === "object") {
      delete req.body.username;
      delete req.body.password;
    }
  }

  res.status(200);
  // SSE (text/event-stream) is required for streaming through Cloud Run.
  // Cloud Run's GFE has a fast-path for this content type that bypasses its
  // response buffer. Other types (application/x-ndjson, etc.) are buffered
  // by the GFE until res.end(), delivering all events at once.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  // Explicit chunked encoding so each write maps to one HTTP/1.1 chunk.
  res.setHeader("Transfer-Encoding", "chunked");
  res.flushHeaders();
  // Padding comment: Cloud Run GFE may buffer the first ~256 bytes for
  // content-type sniffing even with text/event-stream. This pushes past it.
  res.write(`: ${" ".repeat(256)}\n\n`);

  const write = (event: { t: string; type: string; line: string }) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      // Force the kernel TCP buffer to flush immediately so each event is
      // delivered as its own chunk rather than being coalesced.
      (res.socket as import("net").Socket | null)?.write?.("");
    }
  };

  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    await runSmtpTest(payload, write, controller.signal);
  } catch {
    // smtpTester already emitted the error event into the stream.
  } finally {
    res.end();
  }
});

// Mount at root (local dev / Cloud Run) and /api (Firebase Hosting rewrite)
app.use("/", router);
app.use("/api", router);

// Export for Firebase Functions / Cloud Functions — they provide the HTTP server.
// When running standalone (local dev, VPS, Cloud Run) the block below binds the port.
export { app };

// Do not bind a port when running inside Firebase / Cloud Functions.
// K_SERVICE      — set by Cloud Run AND Firebase Functions 2nd gen at runtime.
// FUNCTION_TARGET — set by Firebase Functions emulator.
// FIREBASE_CONFIG — set by Firebase CLI when loading code for deploy analysis.
// FORCE_STANDALONE — set in Dockerfile to run as a plain Cloud Run service
//                    without the Firebase Functions wrapper (K_SERVICE is still
//                    set by Cloud Run in that case, so we need the override).
const isFirebaseFunctions =
  !process.env.FORCE_STANDALONE &&
  (process.env.FUNCTION_TARGET || process.env.FIREBASE_CONFIG);

if (!isFirebaseFunctions) {
  app.listen(port, () => {
    console.log(`SMTP8 API listening on :${port}`);
  });
}
