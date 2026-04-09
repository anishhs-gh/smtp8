# Phase 1 Checklist - SMTP Tester

## Architecture and Repo Setup
- [ ] Define repo layout: `frontend/` and `backend/` as separate projects.
- [ ] Decide on SSE vs WebSockets for live streaming (default: SSE).
- [ ] Select SMTP client library and confirm protocol event hooks.
- [ ] Draft API contract for `/test` endpoint and stream payload schema.

## Security and Abuse Protection
- [ ] Confirm no credential logging and redact sensitive fields in errors.
- [ ] Add request validation and input sanitization.
- [ ] Plan rate limiting strategy (Cloud Armor / API Gateway).
- [ ] Decide on captcha trigger for suspicious IPs.

## Backend (Cloud Run)
- [ ] Implement SMTP handshake + auth test.
- [ ] Emit structured protocol events (timestamped, level, direction).
- [ ] Stream events to client (SSE/WebSockets).
- [ ] Add timeout and cancellation handling.
- [ ] Provide clear error mapping for auth failure vs network failure.

## Frontend (Firebase Hosting)
- [ ] Implement SMTP config form based on Stitch UI.
- [ ] Display live status and protocol inspector stream.
- [ ] Provide secure input handling and masking for secrets.
- [ ] Add clear start/stop test controls.

## Observability
- [ ] Metrics for request counts, failures, latency.
- [ ] Error logging without sensitive data.

## Validation
- [ ] Test against common SMTP providers.
- [ ] Verify no credentials are persisted or logged.
- [ ] Load test for concurrency and stream stability.
