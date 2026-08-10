import { motion, AnimatePresence } from 'framer-motion';

export default function MapTransition({ map, mission, onContinue, visible, stats = {}, isLastMission = false }) {
  if (!visible || !map) return null;

  const questionsAnswered = stats.questionsAnswered ?? 0;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
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

          <p className="text-[10px] uppercase tracking-widest text-violet-400 mb-1">Mission Complete</p>
          <h2 className="text-2xl font-bold text-white mb-1">
            {mission?.name || map.name}
          </h2>
          <p className="text-violet-300 text-sm mb-6">
            {isLastMission ? 'Final mission cleared!' : 'Great run — ready for the next challenge?'}
          </p>

          <div className="grid grid-cols-2 gap-2 mb-6">
            <div className="game-panel p-3 rounded-xl">
              <p className="text-lg font-bold text-amber-400">⭐ {stats.sessionXp ?? 0}</p>
              <p className="text-[10px] text-slate-400">Session XP</p>
            </div>
            <div className="game-panel p-3 rounded-xl">
              <p className="text-lg font-bold text-emerald-400">{questionsAnswered}/{stats.totalQuestions ?? 3}</p>
              <p className="text-[10px] text-slate-400">Questions Answered</p>
            </div>
            <div className="game-panel p-3 rounded-xl">
              <p className="text-lg font-bold text-violet-300">
                {map.collectibleEmoji} {stats.collectedCount ?? 0}
              </p>
              <p className="text-[10px] text-slate-400">{map.collectibleLabel}</p>
            </div>
            <div className="game-panel p-3 rounded-xl">
              <p className="text-lg font-bold text-rose-400">{stats.penalties ?? 0}</p>
              <p className="text-[10px] text-slate-400">Penalties</p>
            </div>
          </div>

          <motion.button
            type="button"
            className="game-btn-primary w-full py-4 rounded-2xl font-semibold"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onContinue}
          >
            {isLastMission ? 'View Adventure Summary →' : 'Next Mission →'}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
