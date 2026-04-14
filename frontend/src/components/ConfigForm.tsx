import type React from "react";
import type { EncryptionMode } from "../types";

type ConfigFormProps = {
  form: {
    host: string;
    port: string;
    username: string;
    password: string;
    encryption: EncryptionMode;
    clientName: string;
  };
  errorMessage: string | null;
  running: boolean;
  onChange: (field: keyof ConfigFormProps["form"], value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onStop: () => void;
};

const ENCRYPTION_OPTIONS: { value: EncryptionMode; label: string }[] = [
  { value: "NONE", label: "NONE" },
  { value: "STARTTLS", label: "STARTTLS" },
  { value: "SSL_TLS", label: "SSL/TLS" },
];

export default function ConfigForm({
  form,
  errorMessage,
  running,
  onChange,
  onSubmit,
  onStop,
}: ConfigFormProps) {
  return (
    <div className="col-span-12 lg:col-span-7 bg-surface-container rounded-xl p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold text-on-surface">Configuration</h3>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Host + Port */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Host Address
            </label>
            <input
              type="text"
              placeholder="smtp.provider.com"
              value={form.host}
              onChange={(e) => onChange("host", e.target.value)}
              className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/50 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all text-base"
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Port
            </label>
            <input
              type="text"
              placeholder="587"
              value={form.port}
              onChange={(e) => onChange("port", e.target.value)}
              className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/50 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all text-base"
            />
          </div>
        </div>

        {/* Username + Password */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Username
            </label>
            <input
              type="text"
              placeholder="user@domain.com"
              value={form.username}
              onChange={(e) => onChange("username", e.target.value)}
              autoComplete="off"
              className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/50 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all text-base"
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={form.password}
              onChange={(e) => onChange("password", e.target.value)}
              autoComplete="new-password"
              className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/50 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all text-base"
            />
          </div>
        </div>

        {/* Encryption */}
        <div>
          <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
            Encryption Protocol
          </label>
          <div className="grid grid-cols-3 gap-3">
            {ENCRYPTION_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange("encryption", value)}
                className={`py-3 rounded-xl text-xs font-semibold transition-all ${
                  form.encryption === value
                    ? "bg-primary-container/20 border border-primary text-primary"
                    : "bg-surface-container-highest border border-outline-variant/20 text-on-surface hover:border-primary/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Client Name */}
        <div>
          <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
            Client Name
          </label>
          <input
            type="text"
            placeholder="smtp8.local"
            value={form.clientName}
            onChange={(e) => onChange("clientName", e.target.value)}
            className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/50 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all text-base"
          />
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="px-4 py-3 bg-error/8 border border-error/30 rounded-xl text-error text-sm">
            {errorMessage}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={running}
            className="flex-1 py-4 bg-gradient-to-r from-tertiary to-tertiary-container text-on-tertiary rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-tertiary/10 hover:shadow-tertiary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[20px]">bolt</span>
            Run SMTP Test
          </button>
          {running && (
            <button
              type="button"
              onClick={onStop}
              className="px-5 py-4 border border-outline-variant/30 text-on-surface-variant rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-all"
            >
              Stop
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
