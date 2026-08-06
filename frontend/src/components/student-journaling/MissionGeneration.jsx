import { motion } from 'framer-motion';

const DIFFICULTY_COLORS = {
  Easy: { bg: 'rgba(16,185,129,0.12)', color: '#047857', border: 'rgba(16,185,129,0.25)' },
  Medium: { bg: 'rgba(245,158,11,0.12)', color: '#b45309', border: 'rgba(245,158,11,0.25)' },
  Hard: { bg: 'rgba(244,63,94,0.12)', color: '#be123c', border: 'rgba(244,63,94,0.25)' },
};

export default function MissionGeneration({ missions, onBeginJourney }) {
  const totalXP = missions.reduce((s, m) => s + m.xp, 0);

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-8" style={{ background: '#f8fafc' }}>
      <motion.div
        className="mx-auto w-full max-w-6xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-blue-600/70 mb-1">Step 2 of 2</p>
          <h1 className="text-2xl font-semibold text-slate-800">Your Missions</h1>
          <p className="text-sm text-slate-600 mt-1">
            {missions.length} mission{missions.length > 1 ? 's' : ''} generated · {totalXP} XP available
          </p>
        </div>

        <div className="grid gap-3 mb-6 lg:grid-cols-2">
          {missions.map((m, i) => {
            const dc = DIFFICULTY_COLORS[m.difficulty] || DIFFICULTY_COLORS.Medium;
            return (
              <motion.div
                key={m.id}
                className="rounded-2xl p-4 border relative overflow-hidden"
                style={{ background: '#ffffff', borderColor: '#e2e8f0' }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 160 }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border"
                    style={{ flexShrink: 0, background: 'rgba(168,85,247,0.12)', borderColor: 'rgba(168,85,247,0.25)' }}
                  >
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{m.name}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{m.subject}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-md border font-medium"
                      style={{ background: dc.bg, color: dc.color, borderColor: dc.border }}
                    >
                      {m.difficulty}
                    </span>
                  </div>
                </div>

                <div className="h-1 rounded-full mb-2" style={{ background: 'rgba(226,232,240,0.95)' }}>
                  <div className="h-full w-0 rounded-full" style={{ background: 'linear-gradient(90deg, #3b82f6, #a855f7)' }} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Not started</span>
                  <span className="text-xs font-semibold text-amber-600">+{m.xp} XP</span>
                </div>

                <motion.div
                  className="absolute top-0 right-0 w-20 h-20 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.08), transparent)', transform: 'translate(40%, -40%)' }}
                />
              </motion.div>
            );
          })}
        </div>

        <motion.button
          className="w-full py-4 rounded-2xl text-sm font-semibold text-white border-0 relative overflow-hidden sm:mx-auto sm:max-w-md"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBeginJourney}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <motion.div
            className="absolute inset-0 opacity-30"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)' }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }}
          />
          <span className="relative">⚡ Begin Journey with NOVA</span>
        </motion.button>
      </motion.div>
    </div>
  );
}
