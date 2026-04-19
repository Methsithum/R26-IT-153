export function SemesterReflection({ values, onTextChange, onSliderChange, onSubmit, loading }) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-slate-200">Overall semester reflection</label>
          <textarea
            value={values.overall}
            onChange={(event) => onTextChange('overall', event.target.value)}
            className="min-h-24 w-full rounded-xl border border-amber-500/20 bg-slate-950/70 p-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-200">Major challenge highlights</label>
          <textarea
            value={values.challenges}
            onChange={(event) => onTextChange('challenges', event.target.value)}
            className="min-h-24 w-full rounded-xl border border-amber-500/20 bg-slate-950/70 p-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div className="space-y-3">
          <SliderField
            label="Overall workload"
            value={values.workload}
            onChange={(value) => onSliderChange('workload', value)}
          />
          <SliderField
            label="Academic support quality"
            value={values.supportQuality}
            onChange={(value) => onSliderChange('supportQuality', value)}
          />
          <SliderField
            label="Personal productivity"
            value={values.productivity}
            onChange={(value) => onSliderChange('productivity', value)}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading}
        className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit Semester Reflection'}
      </button>
    </section>
  )
}

function SliderField({ label, value, onChange }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm text-slate-200">
        <span>{label}</span>
        <span className="text-amber-300">{value}/10</span>
      </div>
      <input
        type="range"
        min="1"
        max="10"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-amber-500"
      />
    </div>
  )
}
