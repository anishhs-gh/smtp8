import { NavLink } from "react-router-dom";

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-tertiary font-semibold"
    : "text-on-surface-variant hover:text-on-surface transition-colors duration-200";

export default function TopBar() {
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-8 py-4 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10">
      <NavLink to="/" className="text-xl font-bold tracking-tighter text-on-surface">
        SMTP8
      </NavLink>

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
    </header>
  );
}
