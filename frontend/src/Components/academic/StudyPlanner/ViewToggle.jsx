const VIEWS = ["Today", "Week", "Month", "Semester"];

export default function ViewToggle({ value, onChange }) {
  return (
    <div className="inline-flex bg-white dark:bg-white/5 rounded-2xl p-1 border border-black/5 dark:border-white/10">
      {VIEWS.map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`relative px-4 py-1.5 text-sm font-semibold rounded-xl transition-colors ${
            value === v ? "bg-brand-500 text-white shadow-playful" : "text-slate-500 dark:text-slate-300 hover:text-brand-600"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
