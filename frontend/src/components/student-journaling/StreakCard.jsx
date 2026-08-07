import { motion } from 'framer-motion';

export default function StreakCard({ streak, dark = false }) {
  const streakColor = dark ? '#fbbf24' : '#b45309';
  const labelColor = dark ? 'rgba(251,191,36,0.7)' : 'rgba(180,83,9,0.8)';

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl p-4 border"
      style={{
        background: dark
          ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))'
          : 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.08))',
        borderColor: dark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.32)',
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: labelColor }}>Daily Streak</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold" style={{ color: streakColor }}>{streak}</span>
            <span className="text-sm" style={{ color: labelColor }}>days</span>
          </div>
        </div>
        <motion.div
          className="text-4xl select-none"
          animate={{
            scale: [1, 1.12, 1],
            rotate: [-3, 3, -3],
          }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          🔥
        </motion.div>
      </div>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-full"
            style={{
              background: i < (streak % 7 || 7)
                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                : 'rgba(148,163,184,0.25)',
            }}
          />
        ))}
      </div>
      <p className="text-[10px] mt-1.5" style={{ color: labelColor }}>This week</p>
    </motion.div>
  );
}
