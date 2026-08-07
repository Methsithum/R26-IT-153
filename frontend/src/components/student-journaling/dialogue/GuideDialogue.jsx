import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QuestionOptions from '../QuestionOptions';
import DatePickerQuestion from '../DatePickerQuestion';

const normalizeOptions = (options = []) =>
  options.map((option) => (typeof option === 'string' ? { text: option } : option));

export default function GuideDialogue({
  visible,
  session,
  onAnswer,
  collectedCount = 0,
  collectibleLabel = 'items',
  isSubmitting = false,
  bossName = '',
}) {
  const [selected, setSelected] = useState(null);
  const question = session?.question || '';
  const intro = session?.intro || '';
  const options = normalizeOptions(session?.options || []);
  const questionType = session?.question_type || 'multiple_choice';

  if (!visible || !question) return null;

  const handleConfirm = () => {
    if (selected === null) return;
    const text = typeof options[selected] === 'string' ? options[selected] : options[selected]?.text;
    onAnswer?.({ answer: text });
    setSelected(null);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 z-30 flex items-end justify-center p-3 sm:p-6"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="game-panel w-full max-w-xl p-5 sm:p-6 rounded-3xl border border-violet-500/30"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <motion.div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border border-violet-400/40"
              style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(99,102,241,0.4))' }}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              ✨
            </motion.div>
            <div>
              <p className="text-sm font-bold text-violet-300">Luna</p>
              <p className="text-[10px] text-slate-500">Your Academic Adventure Companion</p>
            </div>
          </div>

          {bossName && (
            <p className="text-xs text-amber-400 mb-2">⚔️ Checkpoint — {bossName} ahead</p>
          )}

          {intro && (
            <motion.p
              key={intro}
              className="text-sm text-emerald-300 leading-relaxed mb-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {intro}
            </motion.p>
          )}

          {!intro && collectedCount > 0 && (
            <p className="text-xs text-emerald-400 mb-3">
              You collected {collectedCount} {collectibleLabel} on this run!
            </p>
          )}

          <motion.p
            key={question}
            className="text-sm text-slate-200 leading-relaxed mb-5 min-h-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            &ldquo;{question}&rdquo;
          </motion.p>

          {questionType === 'deadline_picker' ? (
            <DatePickerQuestion
              onSelect={(date) => onAnswer?.({ answer: `Deadline: ${date.toLocaleDateString()}`, deadline: date.toISOString() })}
              onCancel={() => onAnswer?.({ answer: 'Skip for now' })}
            />
          ) : (
            <>
              <QuestionOptions
                options={options}
                selected={selected}
                onSelect={setSelected}
                variant="game"
              />
              <motion.button
                type="button"
                className="game-btn-primary w-full mt-4 py-3.5 rounded-xl font-semibold disabled:opacity-40"
                disabled={selected === null || isSubmitting}
                whileHover={selected !== null ? { scale: 1.01 } : {}}
                whileTap={selected !== null ? { scale: 0.98 } : {}}
                onClick={handleConfirm}
              >
                {isSubmitting ? 'Sending...' : 'Confirm Answer →'}
              </motion.button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
