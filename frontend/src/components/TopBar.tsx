import { useState } from "react";
import { NavLink } from "react-router-dom";

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-tertiary font-semibold"
    : "text-on-surface-variant hover:text-on-surface transition-colors duration-200";

export default function TopBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10">
      <div className="flex justify-between items-center px-8 py-4">
        <NavLink to="/" className="flex items-center" onClick={() => setMenuOpen(false)}>
          <img src="/smtp8-logo-text-256.png" alt="SMTP8" className="h-8 w-auto" />
        </NavLink>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
          <NavLink to="/" end className={navClass}>
            Dashboard
          </NavLink>
          <NavLink to="/docs" className={navClass}>
            Docs
          </NavLink>
          {/* API tab hidden temporarily — page exists at /api but not linked */}
          {/* <NavLink to="/api" className={navClass}>API</NavLink> */}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 space-y-1.5"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-0.5 bg-on-surface transition-transform duration-200 ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`block w-5 h-0.5 bg-on-surface transition-opacity duration-200 ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-on-surface transition-transform duration-200 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <nav className="md:hidden flex flex-col px-8 py-4 space-y-4 text-sm font-medium border-t border-outline-variant/10">
          <NavLink to="/" end className={navClass} onClick={() => setMenuOpen(false)}>
            Dashboard
          </NavLink>
          <NavLink to="/docs" className={navClass} onClick={() => setMenuOpen(false)}>
            Docs
          </NavLink>
          {/* API tab hidden temporarily — page exists at /api but not linked */}
          {/* <NavLink to="/api" className={navClass} onClick={() => setMenuOpen(false)}>API</NavLink> */}
        </nav>
      )}
    </header>
  );
}
