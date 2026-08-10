import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/** In-game input overlay for number / text / date questions. */
export default function InGameInput({
  gate,
  visible,
  onSubmit,
  onCancel,
  isSubmitting,
}) {
  const [value, setValue] = useState('');

  if (!visible || !gate) return null;

  const type = gate.question_type || 'text';
  const isNumber = type === 'number';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit?.(gate, value.trim());
    setValue('');
  };

  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 z-30 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.form
          onSubmit={handleSubmit}
          className="game-panel max-w-md w-full p-6 rounded-2xl border-2 border-violet-500/40"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
        >
          <p className="text-[10px] uppercase tracking-widest text-violet-400 mb-2">In-game input</p>
          <p className="text-lg font-semibold text-white mb-4">{gate.question}</p>

          <input
            type={isNumber ? 'number' : type === 'date' ? 'date' : 'text'}
            step={isNumber ? '0.01' : undefined}
            min={isNumber ? '0' : undefined}
            max={isNumber ? '4' : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg focus:outline-none focus:border-violet-400"
            placeholder={isNumber ? 'e.g. 3.21' : 'Type your answer...'}
            autoFocus
          />

          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={!value.trim() || isSubmitting}
              className="flex-1 py-3 rounded-xl game-btn-primary font-semibold disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Continue →'}
            </button>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  );
}
