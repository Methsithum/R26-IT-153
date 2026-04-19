export function ProgressSummaryCard({ label, value, subtitle }) {
  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 font-cinzel text-2xl text-amber-300">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
    </article>
  )
}
