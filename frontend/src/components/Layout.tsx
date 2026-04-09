import type React from "react";
import { Link } from "react-router-dom";
import TopBar from "./TopBar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <TopBar />
      <div className="flex-1">{children}</div>
      <footer className="flex justify-between items-center px-8 py-5 border-t border-outline-variant/10">
        <div className="text-[11px] uppercase tracking-widest text-on-secondary-container">
          © 2025 SMTP8. All systems operational.
        </div>
        <div className="flex gap-6">
          {(["Privacy", "Terms", "Status"] as const).map((label) => (
            <Link
              key={label}
              to={`/${label.toLowerCase()}`}
              className="text-[11px] uppercase tracking-widest text-on-secondary-container hover:text-on-surface transition-colors opacity-80 hover:opacity-100"
            >
              {label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
