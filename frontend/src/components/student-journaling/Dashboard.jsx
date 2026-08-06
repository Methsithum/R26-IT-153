import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import LevelCard from './LevelCard';
import XPBar from './XPBar';
import StreakCard from './StreakCard';

const formatJournalHeaderDate = (date) => {
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
  return `${weekday} · Academic Journal`;
};

const DEFAULT_STUDENT = {
  name: 'Ashan Perera',
  department: 'Software Engineering',
  year: 3,
  level: 7,
  xp: 2340,
  xpMax: 3000,
  streak: 12,
  missionsCompleted: 24,
  achievements: 8,
};

const BADGE_CATALOG = {
  first_journal: { icon: '🏆', name: 'First Journal Entry', desc: 'Completed your first journal session' },
  streak_3: { icon: '🔥', name: '3-Day Streak', desc: 'Maintained 3 days streak' },
  streak_7: { icon: '🔥', name: '7-Day Streak', desc: 'Maintained 7 days streak' },
  streak_30: { icon: '🔥', name: '30-Day Streak', desc: 'Maintained 30 days streak' },
  journal_10: { icon: '📓', name: '10 Journals', desc: 'Completed 10 journal entries' },
  journal_30: { icon: '📘', name: '30 Journals', desc: 'Completed 30 journal entries' },
  journal_50: { icon: '📚', name: '50 Journals', desc: 'Completed 50 journal entries' },
  xp_500: { icon: '⚡', name: '500 XP', desc: 'Reached 500 total XP' },
  xp_1000: { icon: '⚡', name: '1000 XP', desc: 'Reached 1000 total XP' },
  xp_2500: { icon: '⚡', name: '2500 XP', desc: 'Reached 2500 total XP' },
  tasks_5: { icon: '✅', name: '5 Tasks Completed', desc: 'Completed 5 tasks' },
  tasks_10: { icon: '✅', name: '10 Tasks Completed', desc: 'Completed 10 tasks' },
};

const DEFAULT_ACHIEVEMENTS = [
  { icon: '🏆', name: 'First Mission', desc: 'Completed your first mission' },
  { icon: '🔥', name: '7-Day Streak', desc: 'Maintained 7 days streak' },
  { icon: '⚡', name: 'Quick Learner', desc: 'Completed 5 missions in one day' },
];

const formatBadgeAchievement = (badgeKey) => {
  if (!badgeKey) return null;
  if (typeof badgeKey === 'object') {
    return {
      icon: badgeKey.icon || '🏅',
      name: badgeKey.name || badgeKey.label || 'Achievement',
      desc: badgeKey.desc || badgeKey.description || 'Unlocked from your progress',
    };
  }

  const catalogEntry = BADGE_CATALOG[String(badgeKey)] || {
    icon: '🏅',
    name: String(badgeKey).replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
    desc: 'Unlocked from your progress',
  };

  return catalogEntry;
};

export default function Dashboard({ missions, onStartJourney, student = DEFAULT_STUDENT }) {
  const [journalDateLabel, setJournalDateLabel] = useState(() => formatJournalHeaderDate(new Date()));

  useEffect(() => {
    const updateLabel = () => setJournalDateLabel(formatJournalHeaderDate(new Date()));
    const timerId = window.setInterval(updateLabel, 60 * 1000);
    return () => window.clearInterval(timerId);
  }, []);

  const currentStudent = {
    ...DEFAULT_STUDENT,
    ...student,
    xp: student?.xp ?? student?.total_xp ?? DEFAULT_STUDENT.xp,
    streak: student?.streak ?? student?.current_streak ?? DEFAULT_STUDENT.streak,
    missionsCompleted: student?.missionsCompleted ?? student?.completed_sessions ?? student?.total_sessions ?? DEFAULT_STUDENT.missionsCompleted,
    achievements: student?.achievements ?? student?.badges?.length ?? DEFAULT_STUDENT.achievements,
  };

  const achievementCards = (student?.badges?.length ? student.badges : DEFAULT_ACHIEVEMENTS)
    .map(formatBadgeAchievement)
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-8" style={{ background: '#f8fafc' }}>
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <motion.div
        className="relative mx-auto w-full max-w-6xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Smart Uni Guide</p>
            <p className="text-xs text-slate-600 mt-0.5">{journalDateLabel}</p>
          </div>
          <motion.div
            className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-sm"
            whileHover={{ scale: 1.05 }}
          >
            🎓
          </motion.div>
        </div>

        {/* Level + name */}
        <div className="mb-5 p-5 rounded-2xl border" style={{ background: '#ffffff', borderColor: '#e2e8f0' }}>
          <LevelCard
            level={currentStudent.level}
            name={currentStudent.name}
            department={currentStudent.department}
            year={currentStudent.year}
          />
          <div className="mt-4">
            <XPBar current={currentStudent.xp} max={currentStudent.xpMax} level={currentStudent.level} />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 gap-3 mb-5 sm:grid-cols-3">
          {[
            { val: currentStudent.missionsCompleted, label: 'Missions', icon: '✅' },
            { val: `${currentStudent.streak}d`, label: 'Streak', icon: '🔥' },
            { val: currentStudent.achievements, label: 'Badges', icon: '🏅' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              className="rounded-xl p-3 border text-center"
              style={{ background: '#ffffff', borderColor: '#e2e8f0' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.07 }}
            >
              <div className="text-lg mb-1">{s.icon}</div>
              <div className="text-xl font-bold text-slate-800">{s.val}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Streak card */}
        <div className="mb-5">
          <StreakCard streak={currentStudent.streak} />
        </div>

        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Recent Achievements</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {achievementCards.map((a, i) => (
              <motion.div
                key={a.name}
                className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ background: '#ffffff', borderColor: '#e2e8f0' }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.07 }}
              >
                <span className="text-xl">{a.icon}</span>
                <div>
                  <p className="text-xs font-medium text-slate-800">{a.name}</p>
                  <p className="text-[10px] text-slate-500">{a.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA button */}
        <motion.button
          className="w-full py-4 rounded-2xl text-sm font-semibold text-white border-0 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onStartJourney}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <motion.div
            className="absolute inset-0 opacity-30"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)' }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }}
          />
          <span className="relative">⚡ Start Today's Journey</span>
        </motion.button>
      </motion.div>
    </div>
  );
}
