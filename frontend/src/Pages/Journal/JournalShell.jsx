import { NotebookPen } from "lucide-react";

export default function JournalShell({ title, subtitle, aside, children, fill = false }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-canvas">
      <div className="pointer-events-none absolute -top-28 -right-20 h-80 w-80 rounded-full bg-brand-300/30 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-accent-pink/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-brand-200/40 blur-3xl" />

      <div
        className={`relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 sm:py-8 ${
          fill ? "gap-4" : "gap-6"
        }`}
      >
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-400 text-white shadow-playful">
              <NotebookPen size={22} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-500">
                Smart Uni Guide
              </p>
              <h1 className="font-display truncate text-2xl font-bold text-slate-800 sm:text-3xl">
                {title}
              </h1>
              {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
            </div>
          </div>
          {aside}
        </header>
        {children}
      </div>
    </div>
  );
}
