import { motion } from 'framer-motion';

export default function AdventurePreview({ maps, onStart, onBack, isLoading = false }) {
  const totalXp = maps.reduce((s, m) => s + (m.xpReward || 100), 0);
  const totalMinutes = maps.reduce((s, m) => s + (m.durationMinutes || 3), 0);

  return (
    <div className="min-h-screen game-bg px-4 py-8 sm:px-8">
      <motion.div
        className="mx-auto max-w-lg"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-[10px] uppercase tracking-widest text-violet-400 mb-2">Adventure Preview</p>
        <h1 className="text-3xl font-bold text-white mb-2">Today&apos;s Adventure</h1>
        <p className="text-slate-400 text-sm mb-8">
          ~{totalMinutes} min · {totalXp} XP available
        </p>

        <div className="space-y-0 mb-8">
          {maps.map((map, i) => (
            <div key={map.id}>
              <motion.div
                className="game-panel p-4 rounded-2xl flex items-center gap-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
              >
                <span className="text-3xl">{map.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-white">{map.name}</p>
                  <p className="text-xs text-slate-400">{map.description}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-[10px] game-badge">{map.collectibleEmoji} {map.collectibleLabel}</span>
                    <span className="text-[10px] game-badge">⭐ +{map.xpReward} XP</span>
                  </div>
                </div>
              </motion.div>
              {i < maps.length - 1 && (
                <div className="flex justify-center py-2 text-violet-500">↓</div>
              )}
            </div>
          ))}
        </div>

        <motion.button
          type="button"
          className="game-btn-primary w-full py-4 rounded-2xl font-bold text-lg mb-3 disabled:opacity-50"
          whileHover={{ scale: isLoading ? 1 : 1.02 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
          onClick={onStart}
          disabled={isLoading}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {isLoading ? 'Preparing adventure...' : '⚡ START ADVENTURE'}
        </motion.button>

        <button
          type="button"
          onClick={onBack}
          className="w-full py-3 text-sm text-slate-500 hover:text-slate-300 transition"
        >
          ← Back to activity selection
        </button>
      </motion.div>
    </div>
  );
}
