import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LANES } from '../../../constants/gameMaps';

const LANE_HINTS = ['← Far Left', '← Left', 'Right →', 'Far Right →'];

/** HUD banner when approaching an in-path question gate. */
export default function InPathQuestionBanner({ gate, distance, resolved }) {
  if (!gate || resolved || distance == null) return null;

  const show = distance < 55 && distance > 8;
  const urgency = distance < 25;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute top-20 left-0 right-0 z-15 flex justify-center pointer-events-none px-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <div
            className={`game-panel max-w-xl w-full p-4 rounded-2xl border-2 text-center ${
              urgency ? 'border-amber-400/60' : 'border-violet-500/40'
            }`}
          >
            <p className="text-[10px] uppercase tracking-widest text-violet-300 mb-1">
              {urgency ? '⚡ Choose your path!' : '🔮 Question ahead'}
            </p>
            <p className="text-sm sm:text-base font-semibold text-white mb-3">{gate.question}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {gate.options.map((opt, i) => (
                <span
                  key={i}
                  className="text-[10px] sm:text-xs px-2 py-1.5 rounded-lg bg-white/5 text-violet-200 border border-white/10"
                >
                  <span className="block text-[9px] text-slate-500 mb-0.5">{LANE_HINTS[i]}</span>
                  {opt}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Use A/D or arrow keys to move across {LANES.length} lanes
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Brief feedback after recording an answer. */
export function AnswerRecordedToast({ answer, onDone }) {
  useEffect(() => {
    if (!answer) return undefined;
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [answer, onDone]);

  if (!answer) return null;

  return (
    <motion.div
      className="absolute top-1/3 left-0 right-0 z-20 flex justify-center pointer-events-none px-4"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="game-panel px-6 py-4 rounded-2xl text-center border-2 border-violet-400/50 max-w-sm">
        <p className="text-2xl mb-1">📝</p>
        <p className="font-bold text-violet-300">Answer recorded!</p>
        <p className="text-xs text-slate-400 mt-1 truncate">{answer}</p>
        <p className="text-[10px] text-amber-400 mt-1">+15 XP</p>
      </div>
    </motion.div>
  );
}
