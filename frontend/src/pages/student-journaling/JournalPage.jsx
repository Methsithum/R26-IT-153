import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getLevelTitle } from '../../constants/gameMaps';

export default function JournalPage({ result, student, activities = [], onHome, onViewHistory }) {
  const [displayed, setDisplayed] = useState('');
  const journal = result?.journal_entry || 'Your adventure journal will appear here.';

  useEffect(() => {
    let i = 0;
    setDisplayed('');
    const timer = setInterval(() => {
      i += 1;
      setDisplayed(journal.slice(0, i));
      if (i >= journal.length) clearInterval(timer);
    }, 15);
    return () => clearInterval(timer);
  }, [journal]);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen game-bg px-4 py-8 sm:px-8">
      <motion.div
        className="mx-auto max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-[10px] uppercase tracking-widest text-amber-400 mb-2">Your Journey Today</p>
        <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'Georgia, serif' }}>
          📖 Today&apos;s Journal
        </h1>
        <p className="text-slate-500 text-sm mb-6">{today}</p>

        <div className="game-panel p-6 sm:p-8 rounded-3xl mb-6 border border-amber-500/20"
          style={{ background: 'linear-gradient(160deg, rgba(30,27,75,0.9), rgba(15,23,42,0.95))' }}
        >
          <div className="flex flex-wrap gap-2 mb-4">
            {activities.map((a) => (
              <span key={a.id || a} className="game-badge">{a.icon || '📚'} {a.name || a}</span>
            ))}
          </div>

          <p className="text-slate-200 leading-7 text-sm sm:text-base whitespace-pre-wrap" style={{ fontFamily: 'Georgia, serif' }}>
            {displayed}
            {displayed.length < journal.length && (
              <span className="inline-block w-0.5 h-4 ml-1 bg-amber-400 animate-pulse" />
            )}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="game-panel p-3 rounded-xl text-center">
            <p className="text-lg font-bold text-amber-400">+{result?.xp_earned || 0}</p>
            <p className="text-[10px] text-slate-500">XP Earned</p>
          </div>
          <div className="game-panel p-3 rounded-xl text-center">
            <p className="text-lg font-bold text-orange-400">{student?.current_streak || student?.streak || 0}🔥</p>
            <p className="text-[10px] text-slate-500">Streak</p>
          </div>
          <div className="game-panel p-3 rounded-xl text-center">
            <p className="text-lg font-bold text-violet-400">Lv.{student?.level || 1}</p>
            <p className="text-[10px] text-slate-500">{getLevelTitle(student?.level || 1)}</p>
          </div>
        </div>

        <motion.button
          type="button"
          className="game-btn-primary w-full py-4 rounded-2xl font-semibold mb-3"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onViewHistory}
        >
          View Journal History
        </motion.button>

        <button
          type="button"
          onClick={onHome}
          className="w-full py-3 text-sm text-slate-500 hover:text-slate-300"
        >
          Return to Home
        </button>
      </motion.div>
    </div>
  );
}
