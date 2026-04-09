import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8081";

type HealthState = "checking" | "up" | "down";

export default function StatusPage() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [latency, setLatency] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const check = async () => {
    setHealth("checking");
    setLatency(null);
    const t0 = Date.now();
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
      if (res.ok) {
        setLatency(Date.now() - t0);
        setHealth("up");
      } else {
        setHealth("down");
      }
    } catch {
      setHealth("down");
    }
    setCheckedAt(new Date());
  };

  useEffect(() => {
    check();
  }, []);

  const statusConfig: Record<HealthState, { label: string; dot: string; text: string; bg: string }> = {
    checking: {
      label: "Checking...",
      dot: "bg-primary animate-pulse",
      text: "text-primary",
      bg: "bg-primary/8",
    },
    up: {
      label: "Operational",
      dot: "bg-tertiary animate-pulse",
      text: "text-tertiary",
      bg: "bg-tertiary/8",
    },
    down: {
      label: "Unavailable",
      dot: "bg-error",
      text: "text-error",
      bg: "bg-error/8",
    },
  };

  const cfg = statusConfig[health];

  const components = [
    { name: "API Server", state: health },
    { name: "SMTP Test Endpoint", state: health },
    { name: "Firebase Hosting", state: "up" as HealthState },
  ] as const;

  return (
    <main className="pt-28 px-10 pb-16">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-3">System Status</h1>
          <p className="text-on-surface-variant text-[15px]">
            Live health check of SMTP8 services.
          </p>
        </div>

        {/* Overall status banner */}
        <div className={`rounded-xl px-6 py-5 mb-8 ${cfg.bg} border border-outline-variant/10`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${cfg.dot}`} />
              <span className={`text-lg font-bold ${cfg.text}`}>{cfg.label}</span>
            </div>
            <button
              type="button"
              onClick={check}
              className="text-xs text-on-surface-variant hover:text-on-surface transition-colors font-medium uppercase tracking-wider border border-outline-variant/20 px-3 py-1.5 rounded-lg"
            >
              Refresh
            </button>
          </div>
          {latency !== null && (
            <p className="text-sm text-on-surface-variant mt-2">
              API responded in <span className="font-mono text-tertiary">{latency}ms</span>
              {checkedAt && (
                <span className="ml-2 text-outline">
                  · checked at {checkedAt.toLocaleTimeString()}
                </span>
              )}
            </p>
          )}
          {health === "down" && (
            <p className="text-sm text-error mt-2">
              The API server is not responding. This may be a temporary outage.
            </p>
          )}
        </div>

        {/* Component breakdown */}
        <div className="bg-surface-container rounded-xl overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-outline-variant/10">
            <p className="text-[11px] uppercase tracking-widest text-on-surface-variant font-semibold">
              Components
            </p>
          </div>
          {components.map(({ name, state }) => {
            const c = statusConfig[state];
            return (
              <div key={name} className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10 last:border-0">
                <span className="text-sm text-on-surface">{name}</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${c.text}`}>
                    {c.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Uptime note */}
        <div className="bg-surface-container rounded-xl px-5 py-4">
          <p className="text-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">Phase 1 (Beta)</span> — No SLA guarantees.
            The service is provided on a best-effort basis. Planned maintenance windows will be
            communicated in advance.
          </p>
        </div>
      </div>
    </main>
  );
}
