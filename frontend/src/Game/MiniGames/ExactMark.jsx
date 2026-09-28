export default function ExactMark({ value, onChange }) {
  return <label className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-amber-900/20 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
    Exact mark received
    <input aria-label="Exact mark received" type="number" min="0" max="100" step="1" value={value ?? ""} onChange={(event) => {
      const raw = event.target.value;
      onChange(raw === "" ? null : Math.max(0, Math.min(100, Math.round(Number(raw)))));
    }} className="w-20 rounded-lg border border-amber-800/30 bg-white px-2 py-1 text-center text-base" />
    <span>% · Review before saving</span>
  </label>;
}
