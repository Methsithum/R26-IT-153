import { motion } from 'framer-motion';

export default function StreakCard({ streak }) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl p-4 border"
      style={{
        background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(234,179,8,0.08))',
        borderColor: 'rgba(249,115,22,0.25)',
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-orange-400/70 mb-0.5">Daily Streak</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-orange-300">{streak}</span>
            <span className="text-sm text-orange-400/60">days</span>
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
                ? 'linear-gradient(90deg, #f97316, #eab308)'
                : 'rgba(255,255,255,0.07)',
            }}
          />
        ))}
      </div>
      <p className="text-[10px] text-orange-400/50 mt-1.5">This week</p>
    </motion.div>
  );
}
