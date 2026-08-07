import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QuestionOptions from '../../components/student-journaling/QuestionOptions';
import { submitWeeklyReflection } from '../../services/journalApi';

const WEEKLY_QUESTIONS = [
  {
    id: 'achievement',
    message: "You've been on quite an adventure this week! What was your biggest achievement?",
    options: [
      'Finished a major assignment',
      'Maintained my study streak',
      'Learned something completely new',
      'Balanced work and personal life well',
    ],
  },
  {
    id: 'challenge',
    message: 'What challenged you the most this week?',
    options: [
      'Time management',
      'Understanding difficult concepts',
      'Staying motivated',
      'Meeting deadlines',
    ],
  },
  {
    id: 'improvement',
    message: 'What is one thing you want to improve next week?',
    options: [
      'Study consistency',
      'Focus during sessions',
      'Start assignments earlier',
      'Take better notes',
    ],
  },
];

export default function WeeklyReflection({ userId, studentName, onBack }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState({});
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const current = WEEKLY_QUESTIONS[step];
  const isDone = step >= WEEKLY_QUESTIONS.length;

  const handleConfirm = async () => {
    if (selected === null || !current) return;
    const answer = current.options[selected];
    const newAnswers = { ...answers, [current.id]: answer };
    setAnswers(newAnswers);
    setSelected(null);

    if (step < WEEKLY_QUESTIONS.length - 1) {
      setStep((s) => s + 1);
      return;
    }

    if (!userId) {
      setSummary('Reflection saved locally. Sign in to sync with the backend.');
      setStep(WEEKLY_QUESTIONS.length);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      const result = await submitWeeklyReflection({
        user_id: userId,
        week_start: weekStart.toISOString(),
        week_end: now.toISOString(),
        answers: newAnswers,
      });
      setSummary(result?.summary || 'Your weekly reflection has been generated.');
      setStep(WEEKLY_QUESTIONS.length);
    } catch (_e) {
      setError('Could not save reflection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen game-bg px-4 py-8 sm:px-8">
      <motion.div className="mx-auto max-w-xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <button type="button" onClick={onBack} className="text-sm text-slate-500 hover:text-slate-300 mb-6">
          ← Back to Dashboard
        </button>

        {!isDone ? (
          <div className="game-panel p-6 sm:p-8 rounded-3xl border border-violet-500/30">
            <div className="flex items-center gap-3 mb-6">
              <motion.div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border border-violet-400/40"
                style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(99,102,241,0.4))' }}
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                ✨
              </motion.div>
              <div>
                <p className="text-sm font-bold text-violet-300">Luna</p>
                <p className="text-[10px] text-slate-500">Weekly Reflection Guide</p>
              </div>
            </div>

            <div className="flex gap-1.5 mb-5">
              {WEEKLY_QUESTIONS.map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-1 rounded-full"
                  style={{ background: i <= step ? '#8b5cf6' : 'rgba(255,255,255,0.08)' }}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.p
                key={step}
                className="text-sm text-slate-200 leading-relaxed mb-6 min-h-12"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                &ldquo;{current.message.replace('this week', `${studentName || 'Adventurer'}, this week`)}&rdquo;
              </motion.p>
            </AnimatePresence>

            <QuestionOptions options={current.options} selected={selected} onSelect={setSelected} />

            {error && <p className="text-rose-400 text-xs mt-3">{error}</p>}

            <motion.button
              type="button"
              className="game-btn-primary w-full mt-5 py-3.5 rounded-xl font-semibold disabled:opacity-40"
              disabled={selected === null || loading}
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirm}
            >
              {loading ? 'Generating reflection...' : step < WEEKLY_QUESTIONS.length - 1 ? 'Continue →' : '✨ Complete Weekly Reflection'}
            </motion.button>
          </div>
        ) : (
          <motion.div
            className="game-panel p-6 sm:p-8 rounded-3xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-[10px] uppercase tracking-widest text-violet-400 mb-2">Your Weekly Journey</p>
            <h2 className="text-2xl font-bold text-white mb-4">📅 Week in Review</h2>
            <p className="text-slate-300 leading-7 text-sm whitespace-pre-wrap" style={{ fontFamily: 'Georgia, serif' }}>
              {summary}
            </p>
            <button type="button" onClick={onBack} className="game-btn-primary w-full mt-6 py-3.5 rounded-xl font-semibold">
              Return to Dashboard
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
