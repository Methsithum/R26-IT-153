import { motion, AnimatePresence } from 'framer-motion';

export default function GameHUD({
  health = 3,
  sessionXp = 0,
  collectibles = {},
  mapName = '',
  progress = 0,
  collectibleLabel = 'Items',
  collectibleEmoji = '📚',
  floatingXp = [],
  onFloatingXpDone,
}) {
  const totalCollected = Object.values(collectibles).reduce((a, b) => a + b, 0);

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <div className="flex items-start justify-between p-3 sm:p-4">
        <div className="game-panel px-3 py-2 rounded-xl">
          <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className="text-lg">{i < health ? '❤️' : '🖤'}</span>
            ))}
          </div>
        </div>

        <div className="game-panel px-4 py-2 rounded-xl text-center">
          <span className="text-amber-400 text-sm font-bold">⭐ {sessionXp} XP</span>
        </div>

        <div className="game-panel px-3 py-2 rounded-xl">
          <span className="text-xs text-violet-200">
            {collectibleEmoji} {totalCollected} {collectibleLabel}
          </span>
        </div>
      </div>

      <div className="absolute bottom-20 sm:bottom-24 left-0 right-0 px-4">
        <div className="game-panel mx-auto max-w-md p-3 rounded-xl">
          <p className="text-[10px] uppercase tracking-widest text-violet-300 text-center mb-2">
            {mapName}
          </p>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #8b5cf6, #6366f1)' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-1">{Math.round(progress)}%</p>
        </div>
      </div>

      <AnimatePresence>
        {floatingXp.map((fx) => (
          <motion.div
            key={fx.id}
            className="absolute text-amber-400 font-bold text-lg pointer-events-none"
            style={{ left: fx.x || '50%', top: fx.y || '40%' }}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -60, scale: 1.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            onAnimationComplete={() => onFloatingXpDone?.(fx.id)}
          >
            +{fx.value} XP
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
