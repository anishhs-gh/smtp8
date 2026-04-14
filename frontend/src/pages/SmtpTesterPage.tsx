import type React from "react";
import { useState } from "react";
import ConfigForm from "../components/ConfigForm";
import Hero from "../components/Hero";
import LiveResults from "../components/LiveResults";
import ProtocolInspector from "../components/ProtocolInspector";
import type { EncryptionMode, ProtocolEvent, TestStatus } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8081";

// RFC-1123 hostname validation — must match backend
const HOSTNAME_RE =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

const defaultForm = {
  host: "",
  port: "587",
  username: "",
  password: "",
  encryption: "STARTTLS" as EncryptionMode,
  clientName: "smtp8.local",
};

export default function SmtpTesterPage() {
  const [form, setForm] = useState(defaultForm);
  const [status, setStatus] = useState<TestStatus>("idle");
  const [events, setEvents] = useState<ProtocolEvent[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const setField = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const stop = () => {
    abortController?.abort();
    setAbortController(null);
    setStatus("idle");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setEvents([]);

    // ── Client-side validation ────────────────────────────────────────────────
    const host = form.host.trim();
    if (!host) {
      setErrorMessage("Host is required.");
      return;
    }
    if (!HOSTNAME_RE.test(host)) {
      setErrorMessage(
        "Invalid host format. Enter a valid hostname (e.g. smtp.provider.com)."
      );
      return;
    }

    const portValue = Number(form.port);
    if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
      setErrorMessage("Port must be an integer between 1 and 65535.");
      return;
    }

    const username = form.username.trim();
    const password = form.password;

    // Warn if only one of username/password is set
    if ((username && !password) || (!username && password)) {
      setErrorMessage(
        "Provide both username and password, or leave both empty to skip authentication."
      );
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setStatus("running");

    try {
      const response = await fetch(`${API_BASE_URL}/v1/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          port: portValue,
          username: username || undefined,
          password: password || undefined,
          encryption: form.encryption,
          clientName: form.clientName.trim() || undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.error ?? `Request failed (${response.status}).`
        );
      }

      if (!response.body) throw new Error("No response stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx = buffer.indexOf("\n");
        while (idx !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (line) {
            try {
              const ev = JSON.parse(line) as ProtocolEvent;
              setEvents((prev) => [...prev, ev]);
              if (ev.type === "error") setStatus("error");
            } catch {
              // ignore malformed line
            }
          }
          idx = buffer.indexOf("\n");
        }
      }

      setStatus((prev) => (prev === "error" ? "error" : "success"));
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected error."
      );
    } finally {
      setAbortController(null);
    }
  };

  const encryptionDisplay =
    form.encryption === "SSL_TLS"
      ? "SSL/TLS"
      : form.encryption === "STARTTLS"
        ? "STARTTLS"
        : "Unencrypted";

  return (
    <main className="pt-24 px-4 sm:px-10 pb-12">
      <div className="max-w-5xl mx-auto space-y-6">
        <Hero />

        <div className="grid grid-cols-12 gap-6">
          <ConfigForm
            form={form}
            errorMessage={errorMessage}
            running={status === "running"}
            onChange={setField}
            onSubmit={handleSubmit}
            onStop={stop}
          />

          <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
            <LiveResults status={status} events={events} />

            {/* Encryption banner */}
            <div className="h-28 bg-surface-container rounded-xl overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-tertiary/5 to-primary/5" />
              <div className="absolute inset-0 flex flex-col justify-end px-6 pb-5">
                <span className="text-xs font-mono text-tertiary font-bold uppercase tracking-widest">
                  {form.encryption !== "NONE" ? "Encryption Active" : "No Encryption"}
                </span>
                <div className="text-[10px] text-on-secondary-container mt-1 uppercase tracking-wider">
                  {encryptionDisplay} · Port {form.port || "—"}
                </div>
              </div>
            </div>
          </div>

          <ProtocolInspector events={events} onClear={() => setEvents([])} />
        </div>

        {/* CLI callout */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface-container rounded-xl px-6 py-4 border border-outline-variant/10">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-tertiary flex-shrink-0 mt-0.5 sm:mt-0" style={{ fontSize: 20 }}>
              terminal
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-on-surface">Prefer the terminal?</p>
              <p className="text-[13px] text-on-surface-variant">
                SMTP8 is also available as a CLI — interactive prompts, live streaming, same results.
              </p>
            </div>
          </div>
          <code className="self-start sm:flex-shrink-0 text-[13px] font-mono bg-surface px-3 py-1.5 rounded-lg text-tertiary border border-outline-variant/10 select-all">
            npm install -g smtp8
          </code>
        </div>
      </div>
    </main>
  );
}
