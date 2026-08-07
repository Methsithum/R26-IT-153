import { motion, AnimatePresence } from 'framer-motion';

export default function MapTransition({ map, onContinue, visible }) {
  if (!visible || !map) return null;

  const total = map.collectibles?.length ? 25 : 0;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="game-panel max-w-md w-full p-8 rounded-3xl text-center"
          initial={{ scale: 0.8, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          <motion.div
            className="text-6xl mb-4"
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 0.6 }}
          >
            {map.icon}
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-1">{map.name} Complete!</h2>
          <p className="text-violet-300 text-sm mb-6">Great run, adventurer!</p>

          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <span className="game-badge">⭐ +{map.xpReward || 100} XP</span>
            <span className="game-badge">{map.collectibleEmoji} {total} {map.collectibleLabel}</span>
            <span className="game-badge">🏆 {map.name.split(' ')[0]} Explorer</span>
          </div>

          <motion.button
            type="button"
            className="game-btn-primary w-full py-4 rounded-2xl font-semibold"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onContinue}
          >
            Continue Adventure →
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
