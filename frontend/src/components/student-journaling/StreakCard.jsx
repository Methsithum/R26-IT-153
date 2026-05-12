import { motion } from 'framer-motion';

export default function StreakCard({ streak }) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl p-4 border"
      style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.08))',
        borderColor: 'rgba(245,158,11,0.32)',
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-amber-700/80 mb-0.5">Daily Streak</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-amber-700">{streak}</span>
            <span className="text-sm text-amber-700/70">days</span>
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
      <p className="text-[10px] text-amber-700/65 mt-1.5">This week</p>
    </motion.div>
  );
}
