import { Link } from "react-router-dom";
import Logo from "../../Components/academic/Shared/Logo";

export default function AuthShell({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-dvh bg-canvas dark:bg-[#0f0b1f]">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-8 sm:px-8 sm:py-12">
        <Link to="/" className="mb-8 flex items-center gap-3 w-fit">
          <Logo size={44} />
          <div>
            <p className="font-display font-bold text-lg leading-tight text-slate-800 dark:text-white">Smart Uni Guide</p>
            <p className="text-xs text-slate-400 -mt-0.5">Your AI-powered academic planner</p>
          </div>
        </Link>

        <div className="grid flex-1 items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden lg:block pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-500">
              Smart Uni Guide
            </p>
            <h1 className="mt-3 max-w-sm font-display text-4xl font-bold tracking-tight text-slate-800 dark:text-white">
              Plan smarter, not just harder.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Tell us which modules you're taking and Smart Uni Guide builds a personalized,
              ML-driven study schedule around your real deadlines and priorities.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex gap-3">
                <span className="mt-0.5 font-semibold text-brand-500">01</span>
                Every assignment gets a real, model-predicted priority — not a guess.
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 font-semibold text-brand-500">02</span>
                Your weekly schedule adapts automatically as deadlines change.
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 font-semibold text-brand-500">03</span>
                Modules, exams, and your study streak, all in one colorful place.
              </li>
            </ul>
          </div>

          <div className="card w-full p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-800 dark:text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
            <div className="mt-6">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-slate-400">{footer}</div>}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          Your study plan is waiting.{" "}
          <Link to="/" className="text-brand-500 underline-offset-2 hover:underline">
            Open Smart Uni Guide
          </Link>{" "}
          after you sign in.
        </p>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3.5 py-2.5 text-sm text-slate-700 dark:text-white outline-none transition-shadow placeholder:text-slate-400 focus:ring-2 focus:ring-brand-400/50";
