# SMTP8 — Deployment Plan

## Architecture overview

| Layer    | Target                          | Why                                      |
|----------|---------------------------------|------------------------------------------|
| API      | Cloud Functions 2nd gen (→ Cloud Run → VPS) | See decision tree below       |
| Frontend | Firebase Hosting                | Already wired, CDN + free TLS            |
| CLI      | npm registry                    | `npm install -g smtp8`                   |

---

## 1. API — Decision tree

The backend opens raw TCP/TLS sockets to external SMTP servers and streams NDJSON
back to the caller. This rules out any platform that buffers HTTP responses or blocks
outbound TCP.

### Option A — Cloud Functions 2nd gen ✅ (start here)

Cloud Functions 2nd gen runs on Cloud Run infrastructure under the hood. It supports:

- **Streaming responses** — chunked HTTP / NDJSON via `res.write()` + `res.flushHeaders()` works as-is
- **Outbound raw TCP** — `net.connect()` and `tls.connect()` on ports 587 and 465 work without change
- **Scale-to-zero** — no idle cost
- **Pay-per-invocation** — cheap for low-to-moderate traffic

**Port 25 is blocked outbound on all Google Cloud infrastructure** — but this does not
affect normal SMTP8 usage at all. Every major ESP (Gmail, Outlook, SendGrid, Mailgun,
AWS SES, Postmark, etc.) uses port 587 (STARTTLS) or 465 (SSL/TLS) for authenticated
client submission, both of which are fully open on GCP. Port 25 is the old
server-to-server relay port (MTA-to-MTA) — no authenticated third-party credential
uses it. The only edge case is testing a legacy self-hosted internal relay that has
not been configured to accept on 587/465. If that matters, use Option C.

#### Deploy steps

```bash
# 1. Build
cd backend
npm run build           # emits to dist/

# 2. Deploy (Node 20 runtime, 2nd gen, 512 MB, 60 s timeout)
gcloud functions deploy smtp8-api \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=app \           # export the Express app, not app.listen()
  --trigger-http \
  --allow-unauthenticated \
  --memory=512MB \
  --timeout=60s \
  --set-env-vars ALLOWED_ORIGINS=https://your-project.web.app,https://yourdomain.com
```

> **Entry point change required**: Cloud Functions expects a named export, not a
> running HTTP server. Add this at the bottom of `src/server.ts` and guard
> `app.listen` behind an env flag:
>
> ```ts
> export { app };           // for Cloud Functions
> // app.listen(port, ...) only when not running inside Functions
> if (!process.env.K_SERVICE) {
>   app.listen(port, () => console.log(`Listening on :${port}`));
> }
> ```

#### Limitations that push you to Option B

| Condition | Move to Cloud Run? |
|-----------|--------------------|
| Cold start latency is unacceptable | Yes |
| Need >60 s timeout per request | Yes (Cloud Run allows up to 3600 s) |
| Need >1000 concurrent requests | Yes |
| Must test a legacy relay on port 25 | No — blocked on all GCP, move to Option C |

---

### Option B — Cloud Run ✅ (if Option A has operational limits)

Cloud Run is what Cloud Functions 2nd gen wraps. Running it directly gives you more
control: minimum instances (eliminates cold starts), longer timeouts, and no
entry-point export change needed — the Express server runs as-is.

**Port 25 is still blocked.** This is a GCP network policy, not a Cloud Run one.

#### Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

#### Deploy steps

```bash
# 1. Build image
cd backend
npm run build
docker build -t gcr.io/YOUR_PROJECT/smtp8-api .
docker push gcr.io/YOUR_PROJECT/smtp8-api

# 2. Deploy service
gcloud run deploy smtp8-api \
  --image=gcr.io/YOUR_PROJECT/smtp8-api \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=512Mi \
  --timeout=120 \
  --min-instances=0 \           # set to 1 to eliminate cold starts (adds ~$5/mo)
  --set-env-vars PORT=8080,ALLOWED_ORIGINS=https://your-project.web.app
```

Set `PORT=8080` — Cloud Run injects this automatically but be explicit.

---

### Option C — VPS (Hetzner / DigitalOcean / Linode) ✅ (if port 25 is required)

Only a bare-metal or VPS host gives you unrestricted outbound TCP including port 25.
Most providers allow port 25 outbound by default (Hetzner CX11 ~€3.79/mo).

No code changes required. Run the Express server directly with a process manager.

```bash
# On the VPS
npm ci --omit=dev
npm run build

# With PM2
npm install -g pm2
PORT=8081 ALLOWED_ORIGINS=https://yourdomain.com pm2 start dist/server.js --name smtp8-api
pm2 save && pm2 startup

# Reverse proxy with nginx + Let's Encrypt (Certbot)
# Proxy pass :443 → :8081 so the frontend can call https://api.yourdomain.com
```

Nginx config snippet:

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header   Connection "";          # required for chunked streaming
        proxy_buffering    off;                    # required — do not buffer NDJSON
        proxy_read_timeout 90s;
        proxy_set_header   X-Real-IP $remote_addr;
    }
}
```

`proxy_buffering off` is critical. Without it nginx will buffer the NDJSON stream
and the frontend receives no events until the response ends.

---

## 2. Frontend — Firebase Hosting

`firebase.json` is already configured. The `frontend/dist` folder is the publish target.

```bash
cd frontend
npm run build                   # emits to dist/

firebase deploy --only hosting  # from repo root
```

### Environment variable

Create `frontend/.env.production` before building:

```env
VITE_API_BASE_URL=https://your-api-url.com
```

This is baked into the JS bundle at build time by Vite. Do not commit this file —
add it to `.gitignore` and set it in your CI environment instead.

### firebase.json — add SPA rewrite

Add a rewrite rule so the 404 page is handled by React Router rather than Firebase:

```json
{
  "hosting": {
    "public": "frontend/dist",
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

Without this, directly visiting `/docs` or any non-root route returns a Firebase 404
instead of loading the React app.

---

## 3. CLI — npm

```bash
cd cli
npm run build                   # compiles to dist/index.js

# First publish
npm login
npm publish --access public     # package name: smtp8

# Subsequent releases — bump version in package.json first
npm version patch               # or minor / major
npm publish
```

Users install with:

```bash
npm install -g smtp8
smtp8 --help
smtp8 --version
```

Set `SMTP8_API_URL` to point at your deployed API if it is not on `localhost:8081`:

```bash
SMTP8_API_URL=https://your-api-url.com smtp8
```

Or add it to your shell profile:

```bash
export SMTP8_API_URL=https://your-api-url.com
```

---

## 4. Environment variables reference

| Variable          | Where set      | Description                                      |
|-------------------|----------------|--------------------------------------------------|
| `PORT`            | API server     | Port to listen on. Default `8081`.               |
| `ALLOWED_ORIGINS` | API server     | Comma-separated list of allowed CORS origins.    |
| `VITE_API_BASE_URL` | Frontend build | Full URL of the deployed API.                  |
| `SMTP8_API_URL`   | CLI user shell | API base URL override for the CLI.               |

---

## 5. Deploying via Firebase (hosting + API together)

Yes — Firebase can deploy both the frontend and the API in a single project with
one command. This is the recommended setup for the free tier.

Two small, fully reversible code changes are needed in `backend/src/server.ts`
(export `app`, guard `app.listen`). See **`docs/pro-port25-plan.md`** for the
exact diffs, the `firebase.json` rewrite config, and the full rollout plan.

With Firebase rewrites, `VITE_API_BASE_URL` becomes `/api` (relative path) —
no CORS configuration needed since everything is on the same origin.

```bash
# Deploy everything from repo root
firebase deploy          # hosting + functions in one command
```

---

## 7. Recommended rollout order

1. **Deploy API + frontend together** via Firebase (see section 5 and `pro-port25-plan.md`)
2. **Smoke test** — run a real SMTP test in the browser against a known provider (e.g. smtp.gmail.com:587)
3. **Publish CLI** to npm, install globally, run `smtp8` and verify it hits the live API
4. **Port 25 / Pro tier** — if needed later, see `pro-port25-plan.md` for the VPS path

---

## 8. Port 25 — context and provider summary

**Port 25 does not affect testing against any major email provider.** Gmail, Outlook,
SendGrid, Mailgun, AWS SES, and every other ESP accept authenticated submission on
587 or 465 — not 25. Port 25 is reserved for server-to-server relay (MTA-to-MTA).
This section only matters if you need to test a legacy internal mail relay.

| Hosting          | Port 25 outbound | Notes                                                    |
|------------------|-----------------|----------------------------------------------------------|
| Google Cloud     | ❌ Blocked       | All products. No workaround. 587/465 unaffected.         |
| AWS EC2 / Lambda | ❌ Blocked by default | EC2 unblock via support request. Lambda: no.        |
| Hetzner VPS      | ✅ Open          | Cheapest path to port 25. CX11 ~€3.79/mo.               |
| DigitalOcean     | ✅ Open          | May require account verification.                        |
| Fly.io           | ✅ Open          | Easy deploy, generous free tier.                         |

If port 25 support is ever needed, Option C (VPS) is the only viable path.
