import React from "react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-on-surface">{title}</h2>
      <div className="text-[15px] text-on-surface-variant leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="pt-28 px-10 pb-16">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-3">Terms of Service</h1>
          <p className="text-on-surface-variant text-sm">Effective date: April 2026</p>
        </div>

        <div className="space-y-10">
          <Section title="Acceptance">
            <p>
              By using SMTP8 you agree to these terms. If you do not agree, do not use
              the service.
            </p>
          </Section>

          <Section title="Permitted use">
            <p>You may use SMTP8 to:</p>
            <ul className="space-y-2 pl-0">
              {[
                "Test SMTP servers that you own or are explicitly authorized to test.",
                "Verify deliverability settings and credential correctness.",
                "Debug email infrastructure issues in development or production.",
                "Integrate the API into your own tooling for the above purposes.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-tertiary mt-1 flex-shrink-0">›</span>
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Prohibited use">
            <p>You must not use SMTP8 to:</p>
            <ul className="space-y-2 pl-0">
              {[
                "Test servers you do not own or have no authorization to access.",
                "Probe, scan, or enumerate third-party mail servers without permission.",
                "Attempt to bypass rate limits through proxies, VPNs, or automated tooling.",
                "Send spam, phishing content, or any unsolicited mail.",
                "Reverse-engineer or circumvent security controls.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-error mt-1 flex-shrink-0">›</span>
                  {item}
                </li>
              ))}
            </ul>
            <p>
              Violations may result in IP-level blocks and, where applicable, reporting to relevant
              authorities.
            </p>
          </Section>

          <Section title="Rate limits">
            <p>
              To maintain service quality for all users, the API enforces:
            </p>
            <ul className="space-y-2 pl-0">
              {[
                "10 SMTP tests per 60 seconds per IP address.",
                "120 total requests per 15 minutes per IP address across all endpoints.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-primary mt-1 flex-shrink-0">›</span>
                  {item}
                </li>
              ))}
            </ul>
            <p>
              Systematic attempts to circumvent these limits are a violation of these terms.
            </p>
          </Section>

          <Section title="No warranty">
            <p>
              SMTP8 is provided "as is" without warranty of any kind. We make no guarantees
              of uptime, accuracy, or fitness for any particular purpose. This is a developer
              diagnostic tool, not a production-critical service.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the fullest extent permitted by law, SMTP8 and its operators are not liable
              for any damages arising from use or inability to use this service, including but not
              limited to data loss, service disruption, or unauthorized access to systems tested
              using this tool.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              We may update these terms at any time. Continued use of the service after changes
              are posted constitutes acceptance of the revised terms.
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}
