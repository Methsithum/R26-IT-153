import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import useGameSound from '../../hooks/useGameSound';

export default function AdventureComplete({ result, sessionXp, streak, onViewJournal, onHome }) {
  const [showConfetti, setShowConfetti] = useState(true);
  const { playComplete, unlock } = useGameSound(true);

  useEffect(() => {
    unlock();
    playComplete();
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, [playComplete, unlock]);

  const xpEarned = result?.xp_earned || sessionXp || 0;
  const badges = result?.new_badges || [];
  const didLevelUp = result?.level_up;

  return (
    <div className="min-h-screen game-bg flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: ['#8b5cf6', '#f59e0b', '#4ade80', '#f472b6'][i % 4],
                left: `${Math.random() * 100}%`,
                top: -10,
              }}
              animate={{ y: '110vh', rotate: 360, opacity: [1, 0] }}
              transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 0.5 }}
            />
          ))}
        </div>
      )}

      <motion.div
        className="game-panel max-w-md w-full p-8 rounded-3xl text-center relative z-10"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180 }}
      >
        <motion.div
          className="text-7xl mb-4"
          animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.8 }}
        >
          🎉
        </motion.div>

        <h1 className="text-3xl font-bold text-white mb-1">Adventure Complete!</h1>
        <p className="text-violet-300 text-sm mb-6">Your journal is being written...</p>

        <div className="flex flex-wrap justify-center gap-3 mb-6">
          <span className="game-badge text-base">⭐ +{xpEarned} XP</span>
          {streak > 0 && <span className="game-badge text-base">🔥 {streak} Day Streak</span>}
          {didLevelUp && <span className="game-badge text-base">⬆️ Level Up!</span>}
          {badges.map((b) => (
            <span key={b} className="game-badge text-base">🏆 {b}</span>
          ))}
        </div>

        <motion.button
          type="button"
          className="game-btn-primary w-full py-4 rounded-2xl font-semibold mb-3"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onViewJournal}
        >
          📖 View Your Journal
        </motion.button>

        <button
          type="button"
          onClick={onHome}
          className="w-full py-3 text-sm text-slate-500 hover:text-slate-300"
        >
          Return to Dashboard
        </button>
      </motion.div>
    </div>
  );
}
