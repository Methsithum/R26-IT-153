import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QuestionOptions from '../../components/student-journaling/QuestionOptions';
import { submitSemesterReflection } from '../../services/journalApi';

const SEMESTER_QUESTIONS = [
  {
    id: 'highlight',
    message: 'Looking back at this semester, what academic moment are you most proud of?',
    options: [
      'Completing a major project',
      'Improving my grades significantly',
      'Mastering a difficult subject',
      'Consistent daily journaling',
    ],
  },
  {
    id: 'growth',
    message: 'How have you grown as a student this semester?',
    options: [
      'Better time management',
      'Stronger technical skills',
      'More confident in presentations',
      'Better at self-directed learning',
    ],
  },
  {
    id: 'goal',
    message: 'What is your top goal for next semester?',
    options: [
      'Higher GPA',
      'More internship experience',
      'Build a portfolio project',
      'Maintain a longer streak',
    ],
  },
];

export default function SemesterReflection({ userId, student, onBack }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState({});
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const current = SEMESTER_QUESTIONS[step];
  const isDone = step >= SEMESTER_QUESTIONS.length;

  const handleConfirm = async () => {
    if (selected === null || !current) return;
    const answer = current.options[selected];
    const newAnswers = { ...answers, [current.id]: answer };
    setAnswers(newAnswers);
    setSelected(null);

    if (step < SEMESTER_QUESTIONS.length - 1) {
      setStep((s) => s + 1);
      return;
    }

    if (!userId) {
      setSummary('Reflection saved locally. Sign in to sync with the backend.');
      setStep(SEMESTER_QUESTIONS.length);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const semester = `Semester ${new Date().getFullYear()}`;
      const result = await submitSemesterReflection({
        user_id: userId,
        semester,
        answers: newAnswers,
      });
      setSummary(result?.summary || 'Your semester reflection has been generated.');
      setStep(SEMESTER_QUESTIONS.length);
    } catch (_e) {
      setError('Could not save reflection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: 'Adventures', value: student?.completed_sessions ?? student?.missionsCompleted ?? 0, icon: '🗺️' },
    { label: 'Total XP', value: student?.total_xp ?? student?.xp ?? 0, icon: '⭐' },
    { label: 'Best Streak', value: `${student?.longest_streak ?? 0}d`, icon: '🔥' },
    { label: 'Badges', value: student?.badges?.length ?? 0, icon: '🏅' },
  ];

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
                <p className="text-[10px] text-slate-500">Semester Journey Guide</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-6">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl p-2 text-center bg-white/5">
                  <span className="text-lg">{s.icon}</span>
                  <p className="text-sm font-bold text-white">{s.value}</p>
                  <p className="text-[10px] text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.p
                key={step}
                className="text-sm text-slate-200 leading-relaxed mb-6"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                &ldquo;{current.message}&rdquo;
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
              {loading ? 'Generating semester summary...' : step < SEMESTER_QUESTIONS.length - 1 ? 'Continue →' : '🎓 Complete Semester Reflection'}
            </motion.button>
          </div>
        ) : (
          <motion.div
            className="game-panel p-6 sm:p-8 rounded-3xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-[10px] uppercase tracking-widest text-violet-400 mb-2">Semester Journey</p>
            <h2 className="text-2xl font-bold text-white mb-4">🎓 Your Semester Story</h2>

            <div className="grid grid-cols-2 gap-2 mb-6">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl p-3 text-center bg-violet-500/10 border border-violet-500/20">
                  <p className="text-lg font-bold text-white">{s.value}</p>
                  <p className="text-[10px] text-violet-300">{s.label}</p>
                </div>
              ))}
            </div>

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
