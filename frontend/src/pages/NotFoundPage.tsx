import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="pt-28 px-10 pb-16">
      <div className="max-w-2xl mx-auto text-center mt-16">
        <p className="text-7xl font-black text-outline/30 mb-6 tracking-tight">404</p>
        <h1 className="text-2xl font-bold text-on-surface mb-3">Page not found</h1>
        <p className="text-on-surface-variant text-[15px] mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-tertiary hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-base" style={{ fontSize: 18 }}>arrow_back</span>
          Back to tester
        </Link>
      </div>
    </main>
  );
}
