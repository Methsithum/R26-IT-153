import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../utils/helpers'

export function QuestionCard({ question, onAnswer }) {
  const [textValue, setTextValue] = useState('')
  const [multiValue, setMultiValue] = useState([])
  const [duration, setDuration] = useState({ hours: 0, minutes: 30 })
  const [progressStage, setProgressStage] = useState('')

  const options = question?.options || []

  function toggleMulti(option) {
    setMultiValue((prev) =>
      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option],
    )
  }

  function adjustDuration(type, delta) {
    setDuration((prev) => {
      if (type === 'hours') {
        return { ...prev, hours: Math.max(0, prev.hours + delta) }
      }
      return { ...prev, minutes: Math.min(55, Math.max(0, prev.minutes + delta * 5)) }
    })
  }

  function submitMulti() {
    if (!multiValue.length) return
    onAnswer(multiValue)
    setMultiValue([])
  }

  function submitDuration() {
    onAnswer(`${duration.hours}h ${duration.minutes}m`)
  }

  function submitText() {
    if (!textValue.trim()) return
    onAnswer(textValue.trim())
    setTextValue('')
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={question.id}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -40 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl border border-amber-500/20 bg-slate-900/70 p-5"
      >
        <h3 className="font-cinzel text-xl text-amber-200">{question.text}</h3>

        {question.type === 'single_select' && (
          <div className="mt-4 space-y-2">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onAnswer(option)}
                className="block w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-left text-sm text-slate-100 transition hover:border-amber-400 hover:text-amber-200"
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {question.type === 'multi_select' && (
          <div className="mt-4 space-y-2">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => toggleMulti(option)}
                className={cn(
                  'block w-full rounded-xl border px-3 py-2 text-left text-sm transition',
                  multiValue.includes(option)
                    ? 'border-amber-400 bg-amber-400/10 text-amber-200'
                    : 'border-slate-700 bg-slate-800/80 text-slate-100 hover:border-amber-500/60',
                )}
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              onClick={submitMulti}
              className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Confirm
            </button>
          </div>
        )}

        {question.type === 'duration_picker' && (
          <div className="mt-4">
            <div className="mb-3 text-center text-3xl font-semibold text-amber-200">
              {duration.hours}h : {duration.minutes.toString().padStart(2, '0')}m
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => adjustDuration('hours', -1)}
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-800 py-2 text-slate-100"
                >
                  - Hour
                </button>
                <button
                  type="button"
                  onClick={() => adjustDuration('hours', 1)}
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-800 py-2 text-slate-100"
                >
                  + Hour
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => adjustDuration('minutes', -1)}
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-800 py-2 text-slate-100"
                >
                  - 5 Min
                </button>
                <button
                  type="button"
                  onClick={() => adjustDuration('minutes', 1)}
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-800 py-2 text-slate-100"
                >
                  + 5 Min
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={submitDuration}
              className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Set Duration
            </button>
          </div>
        )}

        {question.type === 'text_input' && (
          <div className="mt-4">
            <textarea
              value={textValue}
              onChange={(event) => setTextValue(event.target.value)}
              placeholder={question.placeholder || 'Type your answer'}
              className="min-h-24 w-full rounded-xl border border-amber-500/30 bg-slate-950/70 p-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="button"
              onClick={submitText}
              className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Submit
            </button>
          </div>
        )}

        {question.type === 'progress_select' && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {options.map((stage, index) => {
                const selectedIndex = options.indexOf(progressStage)
                const active = selectedIndex >= index
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setProgressStage(stage)}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-xs font-semibold',
                      active
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-slate-700 bg-slate-800/80 text-slate-300',
                    )}
                  >
                    {stage}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => progressStage && onAnswer(progressStage)}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Confirm Stage
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
