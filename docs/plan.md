# SMTP Tester Web App - Phase 1 Plan

## Summary
Build a performance-oriented SMTP tester web app focused on a single feature set: secure SMTP test execution with live results and a protocol inspector. UI and backend are separate codebases. Frontend hosted on Firebase Hosting. Backend is a dedicated API service. TypeScript everywhere.

## Constraints and Principles
- No history or saved configs in Phase 1.
- Credentials are processed only in memory. No persistent storage. No logging of secrets.
- Rate limiting and abuse protection are mandatory.
- Live results and protocol inspection must not be limited by platform constraints.
- Architecture must scale and be reliable.

## UI Reference
Use `stitch/smtp_tester_workspace/code.html` and `stitch/smtp_tester_workspace/screen.png` as the visual direction for the web UI.

## Architecture Options (Backend)
### Option A: Cloud Functions (GCP)
Pros:
- Easy to deploy and manage.
- Auto-scaling built in.

Cons:
- Not ideal for long-lived connections.
- Live streaming (SSE/WebSockets) can be constrained by cold starts, concurrency, and timeouts.
- Harder to guarantee low latency for live protocol inspection.

### Option B: Cloud Run (Recommended)
Pros:
- Full control over HTTP streaming (SSE) and WebSockets.
- Better for low-latency, long-lived connections.
- Scales horizontally, supports concurrency tuning.
- Containerized deployment with clear isolation.

Cons:
- Slightly more ops than Functions (still low).

## Recommendation
Use Firebase Hosting for the frontend and Cloud Run for the backend API. This avoids the streaming and timeout limits of Cloud Functions while still maintaining serverless scale. Use API Gateway or Cloud Load Balancer + Cloud Armor in front of Cloud Run for rate limiting and abuse protection.

## Data Flow (Phase 1)
1. Frontend collects SMTP config and credentials.
2. Frontend sends request to backend over HTTPS.
3. Backend establishes SMTP session to target host.
4. Backend streams structured protocol events to frontend (SSE/WebSockets).
5. Frontend renders live results and protocol inspector.

## Security Model
- HTTPS only. HSTS on Hosting.
- No credential persistence. No secrets in logs.
- Request logging must redact credentials or be disabled for sensitive endpoints.
- SMTP session occurs only within backend memory.
- Short-lived request-scoped data only.
- Abuse protection: per-IP rate limits, captcha challenge for suspicious traffic, global quotas.

## Tech Stack
- Frontend: TypeScript, React (or equivalent), Tailwind (align to Stitch reference).
- Backend: TypeScript, Node.js (SMTP client library with protocol-level hooks).
- Streaming: SSE preferred, WebSockets if protocol inspector needs bidirectional control.
- Hosting: Firebase Hosting (frontend), Cloud Run (backend).
- Edge security: Cloud Armor or API Gateway rate limiting.

## Phase 1 Deliverables
- Backend API for SMTP test execution with streaming protocol events.
- Frontend UI to configure SMTP connection and view live results + protocol inspector.
- Rate limiting and abuse protection configured.
- Basic observability: metrics and error logs without sensitive data.

## Phase 2 (Later)
- History, saved configs, auth, multi-platform clients, billing, etc.
