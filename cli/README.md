# smtp8

Test any SMTP server in real time — straight from your terminal.

`smtp8` connects directly to an SMTP server, streams every protocol event as it happens, and tells you exactly what failed and why. No credentials are stored or logged. No backend required.

**Live web app** → [smtp8.web.app](https://smtp8.web.app)

---

## Requirements

Node 18 or later.

---

## Installation

```bash
npm install -g smtp8
```

---

## Quick start

```bash
smtp8
```

The CLI walks you through each field interactively:

- **Host** — the SMTP server hostname
- **Port** — default `587`
- **Encryption** — `STARTTLS`, `SSL/TLS`, or `NONE`
- **Username** — leave blank to skip AUTH
- **Password** — leave blank to skip AUTH
- **Client name** — the EHLO hostname sent to the server (default `smtp8.local`)

---

## Non-interactive mode

Skip the prompts entirely by passing all values as flags — useful for scripts and CI:

```bash
smtp8 test --host smtp.gmail.com
smtp8 test --host smtp.gmail.com --port 465 --encryption SSL_TLS
smtp8 test --host smtp.gmail.com --username user@gmail.com --password secret
```

| Flag | Default |
|---|---|
| `--host` | required |
| `--port` | `587` / `465` / `25` based on encryption |
| `--encryption` | `STARTTLS` |
| `--username` | — |
| `--password` | — (prefer `SMTP8_PASSWORD` env var) |
| `--client-name` | `smtp8.local` |

Use `smtp8 test --help` for full usage.

---

## Options

```
--remote          Route the test through the hosted smtp8 API
--api-url <url>   Route the test through a custom API URL (local or remote)
--version, -v     Print version and exit
--help, -h        Show help and exit
```

By default, `smtp8` runs the SMTP test directly from your machine with no backend. Use `--remote` or `--api-url` to route through an API instead.

---

## Configuration

| Source | Description |
|---|---|
| `--api-url <url>` | Route through a specific API URL |
| `--remote` | Route through the hosted smtp8 API |
| `SMTP8_API_URL` | Same as `--api-url` but via environment variable |
| `SMTP8_PASSWORD` | Password for `smtp8 test` (safer than `--password`) |

Priority: `--api-url` → `--remote` → `SMTP8_API_URL` → run directly (default).

---

## Examples

```bash
# Interactive — runs directly, no backend needed
smtp8

# Non-interactive — test Gmail STARTTLS
smtp8 test --host smtp.gmail.com

# Non-interactive — SSL/TLS on port 465
smtp8 test --host smtp.gmail.com --port 465 --encryption SSL_TLS

# Non-interactive with auth (password via env var)
SMTP8_PASSWORD=secret smtp8 test --host smtp.gmail.com --username user@gmail.com

# Route through the hosted API
smtp8 --remote
smtp8 test --host smtp.gmail.com --remote

# Route through a custom or local backend
smtp8 --api-url http://localhost:8081
smtp8 test --host smtp.gmail.com --api-url https://api.example.com
```

---

## Prompt navigation

| Key | Action |
|-----|--------|
| **Tab** | Autofill the placeholder value |
| **Ctrl+C** | Go back to the previous field |
| **Esc** | Clear the current field |

---

## Links

- [GitHub](https://github.com/anishhs-gh/smtp8) — source code and issue tracker
- [smtp8.web.app](https://smtp8.web.app) — browser version
