import { CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'

export function WeeklyReflection({ questions, responses, onChange, onSubmit, loading, submitted }) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="space-y-4">
        {questions.map((question) => {
          const current = responses[question.id] || ''
          return (
            <div key={question.id}>
              <label className="mb-1 block text-sm text-slate-200">{question.prompt}</label>
              <textarea
                value={current}
                onChange={(event) => onChange(question.id, event.target.value)}
                maxLength={question.maxLength}
                className="min-h-24 w-full rounded-xl border border-amber-500/20 bg-slate-950/70 p-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="mt-1 text-right text-xs text-slate-500">
                {current.length}/{question.maxLength}
              </p>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading}
        className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit Weekly Reflection'}
      </button>

      {submitted && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-600/15 p-3 text-emerald-300"
        >
          <CheckCircle2 className="h-5 w-5" />
          Reflection submitted successfully
        </motion.div>
      )}
    </section>
  )
}
