import { Link } from "react-router-dom";

export default function AuthShell({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-dvh bg-white text-stone-800">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-xl">
            🏛️
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-stone-400">
              Smart Uni Guide
            </div>
            <div className="text-sm text-stone-500">Student journal · campus run</div>
          </div>
        </div>

        <div className="grid flex-1 items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden lg:block pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700/80">
              Campus journal
            </p>
            <h1 className="mt-3 max-w-sm text-4xl font-semibold tracking-tight text-stone-900">
              Keep every lecture, deadline and exam in one place.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone-500">
              Register with the subjects you are taking this semester. Your campus run
              only asks about those modules — no fake dates, no leftover guest days.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-stone-600">
              <li className="flex gap-3">
                <span className="mt-0.5 text-amber-700">01</span>
                Day 1 stays Day 1 until you actually complete a run.
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 text-amber-700">02</span>
                Assignments bind to today’s subject. Deadlines never duplicate.
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 text-amber-700">03</span>
                Exam Hall shows only missing Mid / Final dates for your modules.
              </li>
            </ul>
          </div>

          <div className="w-full rounded-3xl border border-stone-200 bg-white p-6 shadow-[0_20px_60px_rgba(28,25,23,0.06)] sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
            <div className="mt-6">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-stone-500">{footer}</div>}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-stone-400">
          Already part of a campus story?{" "}
          <Link to="/" className="text-stone-500 underline-offset-2 hover:underline">
            Open the journal
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
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 outline-none transition-shadow placeholder:text-stone-400 focus:border-amber-700/40 focus:shadow-[0_0_0_4px_rgba(180,83,9,0.08)]";
