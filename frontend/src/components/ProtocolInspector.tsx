import { useEffect, useRef } from "react";
import type { ProtocolEvent } from "../types";
import { formatTime } from "../lib/format";

type ProtocolInspectorProps = {
  events: ProtocolEvent[];
  onClear: () => void;
};

const directionLabel: Record<ProtocolEvent["type"], string> = {
  client: "[SEND]",
  server: "[RECV]",
  info: "[INFO]",
  error: "[ERR ]",
};

const lineClass: Record<ProtocolEvent["type"], string> = {
  client: "text-primary-fixed-dim",
  server: "text-on-surface-variant",
  info: "text-tertiary-fixed-dim",
  error: "text-error",
};

const dirClass: Record<ProtocolEvent["type"], string> = {
  client: "text-primary-fixed-dim",
  server: "text-tertiary",
  info: "text-tertiary-fixed-dim",
  error: "text-error",
};

export default function ProtocolInspector({ events, onClear }: ProtocolInspectorProps) {
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="col-span-12 bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10">
      <div className="flex items-center justify-between mb-4 border-b border-outline-variant/10 pb-4">
        <div className="flex items-center space-x-3">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
            terminal
          </span>
          <h4 className="text-sm font-mono text-on-surface font-bold uppercase tracking-widest">
            Protocol Inspector
          </h4>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] text-on-surface-variant hover:text-tertiary transition-colors uppercase font-bold tracking-wider"
        >
          Clear Log
        </button>
      </div>

      <div
        ref={logRef}
        className="font-mono text-[12px] space-y-1.5 h-52 overflow-y-auto custom-scrollbar leading-relaxed"
      >
        {events.length === 0 ? (
          <p className="text-on-surface-variant/40">Protocol events will stream here once the test starts...</p>
        ) : (
          events.map((event, i) => (
            <p key={`${event.t}-${i}`} className={lineClass[event.type]}>
              <span className="text-outline/40 mr-2">{formatTime(event.t)}</span>
              <span className={`${dirClass[event.type]} font-bold mr-2`}>
                {directionLabel[event.type]}
              </span>
              {event.line}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
