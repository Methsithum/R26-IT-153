import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
            className={`game-panel max-w-lg w-full p-4 rounded-2xl border-2 text-center ${
              urgency ? 'border-amber-400/60' : 'border-violet-500/40'
            }`}
          >
            <p className="text-[10px] uppercase tracking-widest text-violet-300 mb-1">
              {urgency ? '⚡ Choose your path!' : '🔮 Question ahead'}
            </p>
            <p className="text-sm sm:text-base font-semibold text-white mb-2">{gate.question}</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {gate.options.map((opt, i) => (
                <span
                  key={i}
                  className="text-[10px] sm:text-xs px-2 py-1 rounded-lg bg-white/5 text-violet-200 border border-white/10"
                >
                  {i === 0 ? '←' : i === 2 ? '→' : '↑'} {opt}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Move left / center / right to select your answer
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Brief feedback after crossing a question gate. */
export function GateResultToast({ result, onDone }) {
  useEffect(() => {
    if (!result) return undefined;
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [result, onDone]);

  if (!result) return null;

  const isCorrect = result === 'correct';

  return (
    <motion.div
      className="absolute top-1/3 left-0 right-0 z-20 flex justify-center pointer-events-none"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className={`game-panel px-6 py-4 rounded-2xl text-center border-2 ${
          isCorrect ? 'border-emerald-400/50' : 'border-rose-400/50'
        }`}
      >
        <p className="text-2xl mb-1">{isCorrect ? '✅' : '❌'}</p>
        <p className={`font-bold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isCorrect ? 'Correct path! +20 XP' : 'Wrong path! -15 XP'}
        </p>
      </div>
    </motion.div>
  );
}
