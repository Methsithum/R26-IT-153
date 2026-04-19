import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Award } from 'lucide-react'

export function JournalSummary({ journalText, xpEarned, newBadges, onComplete }) {
  const [animatedXp, setAnimatedXp] = useState(0)

  useEffect(() => {
    let frame
    let start = 0
    const duration = 1000
    const begin = performance.now()

    const tick = (time) => {
      const progress = Math.min((time - begin) / duration, 1)
      start = Math.round(progress * xpEarned)
      setAnimatedXp(start)
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [xpEarned])

  return (
    <section className="space-y-4 rounded-2xl border border-amber-500/20 bg-slate-900/65 p-5">
      <div className="max-h-52 overflow-auto rounded-xl border-l-4 border-amber-400 bg-slate-950/70 p-4 text-sm leading-6 text-slate-200">
        {journalText}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-slate-700 bg-slate-950/70 p-4"
      >
        <p className="text-sm text-slate-400">XP Earned</p>
        <p className="font-cinzel text-3xl text-amber-300">+{animatedXp} XP</p>
      </motion.div>

      {newBadges?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {newBadges.map((badge) => (
            <motion.div
              key={badge.id}
              initial={{ scale: 0.75, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2"
            >
              <Award className="h-4 w-4 text-amber-300" />
              <span className="text-sm text-amber-100">{badge.name}</span>
            </motion.div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onComplete}
        className="rounded-xl bg-linear-to-r from-amber-500 to-yellow-300 px-5 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(250,204,21,0.35)] transition hover:scale-105"
      >
        Complete Quest
      </button>
    </section>
  )
}
