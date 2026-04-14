# smtp8

Test any SMTP server in real time — straight from your terminal.

`smtp8` connects directly to an SMTP server, streams every protocol event as it happens, and tells you exactly what failed and why. No credentials are stored or logged.

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
- **Encryption** — `NONE`, `STARTTLS`, or `SSL/TLS`
- **Username** — leave blank to skip AUTH
- **Password** — leave blank to skip AUTH
- **Client name** — the EHLO hostname sent to the server (default `smtp8.local`)

---

## Options

```
--local           Point at http://localhost:8081 instead of the hosted API
--api-url <url>   Use a custom API URL
--version, -v     Print version and exit
--help, -h        Show help and exit
```

---

## Configuration

Set `SMTP8_API_URL` to avoid passing `--api-url` every time:

```bash
export SMTP8_API_URL=https://your-api.example.com
smtp8
```

Priority order: `--api-url` flag → `SMTP8_API_URL` env var → hosted default.

---

## Examples

```bash
# Test Gmail STARTTLS (port 587)
smtp8
# → host: smtp.gmail.com, port: 587, encryption: STARTTLS

# Test SSL/TLS on port 465
smtp8
# → host: smtp.gmail.com, port: 465, encryption: SSL/TLS

# Test against a local mail server
smtp8 --local

# Test against a custom self-hosted API
smtp8 --api-url https://api.example.com
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
