function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="text-xl font-bold text-on-surface mb-4 pb-3 border-b border-outline-variant/15">
        {title}
      </h2>
      <div className="space-y-4 text-[15px] text-on-surface-variant leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 bg-surface-container-highest rounded text-primary-fixed-dim font-mono text-[13px]">
      {children}
    </code>
  );
}

function Field({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 px-4 sm:px-5 py-3.5 border-b border-outline-variant/10 last:border-0">
      <code className="text-tertiary font-mono text-sm sm:w-36 sm:flex-shrink-0 sm:pt-0.5 mb-1 sm:mb-0">{name}</code>
      <span className="text-on-surface-variant text-sm">{desc}</span>
    </div>
  );
}

const PROVIDERS = [
  { provider: "Gmail", host: "smtp.gmail.com", port: 587, enc: "STARTTLS" },
  { provider: "Gmail", host: "smtp.gmail.com", port: 465, enc: "SSL/TLS" },
  { provider: "Outlook / Hotmail", host: "smtp-mail.outlook.com", port: 587, enc: "STARTTLS" },
  { provider: "Apple iCloud", host: "smtp.mail.me.com", port: 587, enc: "STARTTLS" },
  { provider: "Apple iCloud", host: "smtp.mail.me.com", port: 465, enc: "SSL/TLS" },
  { provider: "SendGrid", host: "smtp.sendgrid.net", port: 587, enc: "STARTTLS" },
  { provider: "Mailgun", host: "smtp.mailgun.org", port: 587, enc: "STARTTLS" },
  { provider: "Amazon SES (us-east-1)", host: "email-smtp.us-east-1.amazonaws.com", port: 587, enc: "STARTTLS" },
  { provider: "Zoho Mail", host: "smtp.zoho.com", port: 587, enc: "STARTTLS" },
  { provider: "FastMail", host: "smtp.fastmail.com", port: 587, enc: "STARTTLS" },
];

import React from "react";

export default function DocsPage() {
  return (
    <main className="pt-28 px-4 sm:px-10 pb-16">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-3">Documentation</h1>
          <p className="text-on-surface-variant text-[15px] max-w-xl">
            Everything you need to run precise SMTP tests and interpret the results.
          </p>
        </div>

        {/* On-page nav */}
        <nav className="mb-12 flex flex-wrap gap-3">
          {[
            ["#overview", "Overview"],
            ["#fields", "Configuration Fields"],
            ["#encryption", "Encryption Modes"],
            ["#results", "Reading Results"],
            ["#providers", "Common Providers"],
            ["#troubleshooting", "Troubleshooting"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="px-3 py-1.5 bg-surface-container rounded-lg text-xs font-medium text-on-surface-variant hover:text-tertiary hover:bg-surface-container-high transition-all"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="space-y-14">
          {/* Overview */}
          <Section id="overview" title="Overview">
            <p>
              SMTP8 connects directly to an SMTP server from the backend and streams every
              protocol event back to your browser in real time. No credentials are stored or logged —
              they exist only in memory for the duration of the test.
            </p>
            <p>
              The test performs: TCP/TLS connection → server greeting → EHLO negotiation →
              optional STARTTLS upgrade → optional AUTH → NOOP → QUIT. Each step is streamed as
              it happens so you can observe the full handshake.
            </p>
          </Section>

          {/* Configuration Fields */}
          <Section id="fields" title="Configuration Fields">
            <div className="bg-surface-container rounded-xl overflow-hidden">
              <Field name="Host" desc="The SMTP server hostname. Must be a valid RFC-1123 hostname (e.g. smtp.gmail.com). IP addresses are not accepted." />
              <Field name="Port" desc="TCP port to connect on. Common values: 587 (STARTTLS), 465 (SSL/TLS), 25 (relay/no-auth). Must be 1–65535." />
              <Field name="Username" desc="SMTP auth username. Typically your email address or API key name. Leave empty to skip authentication." />
              <Field name="Password" desc="SMTP auth password or API key. Never stored or logged. Leave empty to skip authentication." />
              <Field name="Encryption" desc="Transport security mode. See Encryption Modes below." />
              <Field name="Client Name" desc="The hostname sent in the EHLO command. Defaults to smtp8.local. Some servers reject connections with non-FQDN EHLO values." />
            </div>
            <p className="text-sm">
              If you provide a username without a password (or vice versa), the test will be rejected
              before connecting — supply both or leave both empty.
            </p>
          </Section>

          {/* Encryption Modes */}
          <Section id="encryption" title="Encryption Modes">
            <div className="space-y-4">
              <div className="bg-surface-container rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-0.5 bg-surface-container-high rounded font-mono text-xs text-tertiary font-bold">STARTTLS</span>
                  <span className="text-xs text-on-surface-variant">Port 587 (typical)</span>
                </div>
                <p className="text-sm">
                  Connects over plain TCP, then upgrades to TLS using the STARTTLS command after the
                  initial EHLO. The server must advertise STARTTLS capability — if it doesn't, the
                  test fails with an explicit error rather than falling back to plaintext.
                  This is the recommended mode for most modern providers.
                </p>
              </div>
              <div className="bg-surface-container rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-0.5 bg-surface-container-high rounded font-mono text-xs text-tertiary font-bold">SSL/TLS</span>
                  <span className="text-xs text-on-surface-variant">Port 465 (typical)</span>
                </div>
                <p className="text-sm">
                  Wraps the entire connection in TLS from the first byte. No plaintext negotiation
                  phase. Required by some providers (iCloud on port 465). Uses TLS 1.2+ with certificate
                  verification enforced.
                </p>
              </div>
              <div className="bg-surface-container rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-0.5 bg-surface-container-high rounded font-mono text-xs text-error font-bold">NONE</span>
                  <span className="text-xs text-on-surface-variant">Port 25 (relay)</span>
                </div>
                <p className="text-sm">
                  Plain TCP with no encryption. Suitable only for testing internal relay servers
                  on trusted networks. Credentials sent in this mode are transmitted in plaintext.
                  Not recommended for any production or public server.
                </p>
              </div>
            </div>
          </Section>

          {/* Reading Results */}
          <Section id="results" title="Reading Results">
            <p className="font-medium text-on-surface">Live Results (step tracker)</p>
            <p className="text-sm">
              Shows the SMTP session as four sequential steps: Connect → Handshake → Authentication →
              Complete. Each step displays its state (pending, in-progress, success, error) and
              timing in milliseconds from the start of the test. Steps dim when pending, so your
              attention is drawn to the active stage.
            </p>
            <p className="font-medium text-on-surface mt-2">Protocol Inspector (raw log)</p>
            <p className="text-sm">
              Streams every raw protocol line with direction and timestamp:
            </p>
            <div className="bg-surface-container-lowest rounded-xl p-4 font-mono text-[12px] space-y-1.5">
              <p><span className="text-outline/60">14:02:01.46</span> <span className="text-tertiary font-bold">[RECV]</span> <span className="text-on-surface-variant">220 smtp.gmail.com ESMTP</span></p>
              <p><span className="text-outline/60">14:02:01.46</span> <span className="text-primary-fixed-dim font-bold">[SEND]</span> <span className="text-primary-fixed-dim">EHLO smtp8.local</span></p>
              <p><span className="text-outline/60">14:02:01.52</span> <span className="text-tertiary-fixed-dim font-bold">[INFO]</span> <span className="text-tertiary-fixed-dim">TLS upgrade complete.</span></p>
              <p><span className="text-outline/60">14:02:01.81</span> <span className="text-error font-bold">[ERR ]</span> <span className="text-error">AUTH PLAIN failed.</span></p>
            </div>
            <p className="text-sm">
              <Code>[SEND]</Code> = commands your client sent.{" "}
              <Code>[RECV]</Code> = server responses.{" "}
              <Code>[INFO]</Code> = internal state changes.{" "}
              <Code>[ERR]</Code> = failures.
              Credentials are always redacted in the log — only <Code>&lt;redacted&gt;</Code> appears.
            </p>
          </Section>

          {/* Common Providers */}
          <Section id="providers" title="Common Providers">
            <p className="text-sm">
              Reference settings for popular email providers. Always check the provider's current
              documentation as these may change.
            </p>
            <div className="bg-surface-container rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/15">
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">Provider</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">Host</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">Port</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">Encryption</th>
                  </tr>
                </thead>
                <tbody>
                  {PROVIDERS.map((p, i) => (
                    <tr key={i} className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-high transition-colors">
                      <td className="px-4 py-3 text-on-surface">{p.provider}</td>
                      <td className="px-4 py-3 font-mono text-[12px] text-primary-fixed-dim">{p.host}</td>
                      <td className="px-4 py-3 font-mono text-[12px] text-on-surface-variant">{p.port}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${p.enc === "STARTTLS" ? "bg-primary/10 text-primary" : "bg-tertiary/10 text-tertiary"}`}>
                          {p.enc}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm">
              <strong className="text-on-surface">Gmail / Google Workspace:</strong> Requires an
              App Password if 2FA is enabled. Standard password won't work.
              {" "}<strong className="text-on-surface">Apple iCloud:</strong> Requires an App-Specific
              Password generated at appleid.apple.com.
            </p>
          </Section>

          {/* Troubleshooting */}
          <Section id="troubleshooting" title="Troubleshooting">
            <div className="space-y-4">
              {[
                {
                  symptom: "Timeout after 15000ms during TCP connect",
                  cause: "Your network or ISP is blocking the outbound SMTP port.",
                  fix: "Try port 465 with SSL/TLS. Run nc -vz smtp.provider.com 587 in a terminal to confirm the port is reachable from your machine.",
                },
                {
                  symptom: "Server does not advertise STARTTLS support",
                  cause: "You selected STARTTLS but the server either doesn't support it or requires SSL/TLS from the start.",
                  fix: "Switch to SSL/TLS on port 465, or verify the correct port with the provider's documentation.",
                },
                {
                  symptom: "AUTH PLAIN / AUTH LOGIN failed",
                  cause: "Credentials are incorrect, or the provider requires App Passwords / API keys.",
                  fix: "Double-check the username and password. For Gmail or iCloud, generate an App Password from your account security settings.",
                },
                {
                  symptom: "SMTP server did not return a 220 greeting",
                  cause: "Connected to the right host/port but it's not an SMTP service, or it's returning a non-standard banner.",
                  fix: "Verify the host and port combination. Some providers use non-standard banners — check the Protocol Inspector for the raw server response.",
                },
                {
                  symptom: "Server does not support AUTH PLAIN or AUTH LOGIN",
                  cause: "The server supports other auth mechanisms (e.g. XOAUTH2) not currently implemented.",
                  fix: "Check the server's EHLO response in the Protocol Inspector for the AUTH line. XOAUTH2 (OAuth 2.0) is not yet supported.",
                },
              ].map((item, i) => (
                <div key={i} className="bg-surface-container rounded-xl p-5 space-y-2">
                  <p className="font-mono text-[12px] text-error bg-error/8 rounded px-2 py-1 inline-block">{item.symptom}</p>
                  <p className="text-sm"><span className="font-semibold text-on-surface">Cause:</span> {item.cause}</p>
                  <p className="text-sm"><span className="font-semibold text-on-surface">Fix:</span> {item.fix}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* API reference link hidden temporarily */}
        </div>
      </div>
    </main>
  );
}
