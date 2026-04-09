import React from "react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-on-surface">{title}</h2>
      <div className="text-[15px] text-on-surface-variant leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function List({ items, tone = "tertiary" }: { items: string[]; tone?: "tertiary" | "primary" | "error" }) {
  return (
    <ul className="space-y-2 pl-0">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className={`text-${tone} mt-1 flex-shrink-0`}>›</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <main className="pt-28 px-10 pb-16">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-3">
            Privacy Policy
          </h1>
          <p className="text-on-surface-variant text-sm">Effective date: April 2026</p>
        </div>

        <div className="space-y-10">

          <Section title="What we collect">
            <p>
              SMTP8 is designed around a zero-retention principle. We do not collect,
              store, or log personal data or SMTP credentials. The only transient operational
              data that exists at runtime is described below.
            </p>
          </Section>

          <Section title="SMTP credentials">
            <p>
              Credentials (username and password) you enter are transmitted over HTTPS to the
              backend API, used solely to authenticate against the target SMTP server you
              specify, and then discarded. Specifically:
            </p>
            <List items={[
              "Never written to disk, a database, or any log output.",
              "Destructured from the parsed request object immediately on receipt, and the original references are set to undefined before any network socket work begins.",
              "Never interpolated into any log line, event, or error message. Auth commands in the protocol stream always display the literal string <redacted> — the encoded credential bytes are written directly to the socket and never stored as a string variable after use.",
              "Error messages are scanned and sanitized before being sent to your browser: any substring that matches the provided username or password is replaced with <redacted> as a defence-in-depth measure.",
              "Never transmitted to any third party. Credentials flow only from your browser → our API → the SMTP server you are testing.",
              "Not recoverable after the request ends. There is no mechanism by which they could be retrieved.",
            ]} />
          </Section>

          <Section title="Operational data">
            <p>
              We do not run server-side HTTP request logging. No request timestamps, status
              codes, or request metadata are written to any log file or external system.
            </p>
            <p>
              The only runtime data that exists is:
            </p>
            <List tone="primary" items={[
              "Source IP address — held in memory by the rate limiter to enforce per-IP request limits. Not written to disk, not linked to any identity, cleared when the server process restarts.",
              "Server startup message — the port number the process is listening on, written to standard output only.",
            ]} />
            <p>
              There is no analytics backend, no metrics pipeline, and no structured logging
              infrastructure in Phase 1. If this changes, this policy will be updated before
              the change takes effect.
            </p>
          </Section>

          <Section title="Cookies and tracking">
            <p>
              This application sets no cookies and runs no analytics, tracking, or fingerprinting
              scripts. The only external resources loaded are fonts from Google Fonts (Inter
              typeface and Material Symbols icons), which are subject to Google's own privacy
              policy.
            </p>
          </Section>

          <Section title="Data retention">
            <p>
              Nothing is retained beyond the lifetime of a single request. In-memory rate
              limit counters are reset when the server process restarts. No backup, archive,
              or export of any user data occurs.
            </p>
          </Section>

          <Section title="Security measures">
            <p>
              The following controls are applied to protect data in transit and at rest:
            </p>
            <List items={[
              "HTTPS (TLS 1.2+) enforced for all browser-to-API communication.",
              "HTTP Strict Transport Security (HSTS) with a one-year max-age and preload flag, preventing protocol downgrade attacks.",
              "Cache-Control: no-store on all SMTP test responses, instructing browsers, CDNs, and proxies never to store the response stream.",
              "Strict CORS policy: only the declared frontend origin is permitted to call the API.",
              "Per-IP rate limiting enforced before any credential processing occurs.",
              "Input validation rejects malformed hostnames, out-of-range ports, and oversized payloads (8 KB body limit) before a connection is attempted.",
              "TLS certificate verification is enforced (rejectUnauthorized: true) on all outbound SMTP connections — the test will fail rather than silently accept an invalid certificate.",
            ]} />
          </Section>

          <Section title="Children">
            <p>
              This service is not directed at children under 13. We do not knowingly collect
              any information from children.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy as the product evolves. The effective date at the top
              of this page reflects when the current version took effect. We will not
              retroactively weaken the protections described here without prior notice.
            </p>
          </Section>

        </div>
      </div>
    </main>
  );
}
