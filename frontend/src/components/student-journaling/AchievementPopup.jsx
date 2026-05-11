import { motion, AnimatePresence } from 'framer-motion';

export default function AchievementPopup({ achievement, onClose }) {
  if (!achievement) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed top-5 left-1/2 z-50 w-[340px] -translate-x-1/2"
        initial={{ y: -80, opacity: 0, scale: 0.85 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -60, opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
      >
        <div
          className="rounded-2xl p-4 border flex items-center gap-4 shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, #1a1530, #0f1020)',
            borderColor: 'rgba(234,179,8,0.35)',
            boxShadow: '0 0 30px rgba(234,179,8,0.15), 0 20px 60px rgba(0,0,0,0.6)',
          }}
        >
          <motion.div
            className="text-4xl flex-shrink-0"
            animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {achievement.icon}
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-yellow-500/70 mb-0.5">
              Achievement Unlocked
            </p>
            <p className="text-sm font-semibold text-yellow-200 truncate">{achievement.name}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{achievement.desc}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-400 flex-shrink-0 transition-colors text-lg"
          >
            ×
          </button>
        </div>
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ border: '1px solid rgba(234,179,8,0.2)' }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
