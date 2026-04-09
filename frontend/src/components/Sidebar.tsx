export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-low flex flex-col p-4 pt-24 z-40">
      <div className="px-4 mb-6">
        <h2 className="text-lg font-black text-on-surface">Precision SMTP</h2>
        <p className="text-[10px] tracking-widest text-on-secondary-container uppercase mt-0.5">
          Developer Workspace
        </p>
      </div>

      <nav className="flex-1 space-y-1">
        {/* Phase 1: single active workspace item */}
        <div className="flex items-center space-x-3 px-4 py-3 bg-surface-container text-tertiary border-r-2 border-tertiary cursor-default rounded-l-xl">
          <span className="material-symbols-outlined text-[20px]">send</span>
          <span className="text-sm tracking-wide font-medium">SMTP Tester</span>
        </div>
      </nav>

      <div className="mt-auto pt-6 space-y-2">
        <div className="flex items-center space-x-3 px-4 py-3 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-[20px]">help</span>
          <span className="text-sm tracking-wide">Support</span>
        </div>
      </div>
    </aside>
  );
}
