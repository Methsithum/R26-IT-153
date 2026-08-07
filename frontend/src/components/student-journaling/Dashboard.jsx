import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import LevelCard from './LevelCard';
import XPBar from './XPBar';
import StreakCard from './StreakCard';
import { getLevelTitle } from '../../constants/gameMaps';

const BADGE_CATALOG = {
  first_journal: { icon: '🏆', name: 'First Journal Entry', desc: 'Completed your first journal session' },
  streak_3: { icon: '🔥', name: '3-Day Streak', desc: 'Maintained 3 days streak' },
  streak_7: { icon: '🔥', name: '7-Day Streak', desc: 'Maintained 7 days streak' },
  streak_30: { icon: '🔥', name: '30-Day Streak', desc: 'Maintained 30 days streak' },
  journal_10: { icon: '📓', name: '10 Journals', desc: 'Completed 10 journal entries' },
  xp_500: { icon: '⚡', name: '500 XP', desc: 'Reached 500 total XP' },
  xp_1000: { icon: '⚡', name: '1000 XP', desc: 'Reached 1000 total XP' },
};

const formatBadge = (badgeKey) => {
  if (!badgeKey) return null;
  if (typeof badgeKey === 'object') {
    return { icon: badgeKey.icon || '🏅', name: badgeKey.name || 'Achievement', desc: badgeKey.desc || '' };
  }
  return BADGE_CATALOG[badgeKey] || {
    icon: '🏅',
    name: String(badgeKey).replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    desc: 'Unlocked from your progress',
  };
};

export default function Dashboard({
  student,
  missions = [],
  onStartJourney,
  onJournal,
  onWeeklyReflection,
  onSemesterReflection,
  onAchievements,
}) {
  const xp = student?.xp ?? student?.total_xp ?? 0;
  const level = student?.level ?? Math.floor(xp / 250) + 1;
  const streak = student?.streak ?? student?.current_streak ?? 0;
  const longestStreak = student?.longest_streak ?? streak;
  const completed = student?.missionsCompleted ?? student?.completed_sessions ?? 0;
  const badges = (student?.badges || []).map(formatBadge).filter(Boolean).slice(0, 4);
  const activeMissions = missions.filter((m) => m.status === 'active');

  return (
    <div className="min-h-screen game-bg px-4 py-6 sm:px-8 sm:py-10">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: '#8b5cf6' }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl" style={{ background: '#6366f1' }} />
      </div>

      <motion.div className="relative mx-auto max-w-4xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-violet-400">Smart Uni Guide</p>
            <h1 className="text-2xl font-bold text-white mt-1">Adventure Hub</h1>
          </div>
          <motion.div
            className="w-14 h-14 rounded-2xl game-panel flex items-center justify-center text-2xl border border-violet-500/30"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            🎓
          </motion.div>
        </div>

        <div className="game-panel p-5 rounded-3xl mb-5 border border-violet-500/20">
          <LevelCard
            level={level}
            name={student?.name || 'Adventurer'}
            department={getLevelTitle(level)}
            year={null}
            dark
          />
          <div className="mt-4">
            <XPBar current={xp} max={(level * 250)} level={level} dark />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { val: completed, label: 'Adventures', icon: '🗺️' },
            { val: `${streak}d`, label: 'Streak', icon: '🔥' },
            { val: `${longestStreak}d`, label: 'Best Streak', icon: '⭐' },
            { val: student?.badges?.length || 0, label: 'Badges', icon: '🏅' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              className="game-panel p-3 rounded-2xl text-center"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
            >
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="text-xl font-bold text-white">{s.val}</div>
              <div className="text-[10px] text-slate-500">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="mb-5">
          <StreakCard streak={streak} dark />
        </div>

        {activeMissions.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Today&apos;s Activities</p>
            <div className="flex flex-wrap gap-2">
              {activeMissions.map((m) => (
                <span key={m.id} className="game-badge">{m.icon} {m.name}</span>
              ))}
            </div>
          </div>
        )}

        {badges.length > 0 && (
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Recent Badges</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {badges.map((b) => (
                <div key={b.name} className="game-panel p-3 rounded-xl flex items-center gap-3">
                  <span className="text-2xl">{b.icon}</span>
                  <div>
                    <p className="text-xs font-medium text-white">{b.name}</p>
                    <p className="text-[10px] text-slate-500">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <motion.button
          type="button"
          className="game-btn-primary w-full py-5 rounded-2xl text-base font-bold relative overflow-hidden mb-4"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onStartJourney}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <motion.div
            className="absolute inset-0 opacity-30"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }}
          />
          <span className="relative">⚡ START TODAY&apos;S ADVENTURE</span>
        </motion.button>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: 'Journal', icon: '📖', action: onJournal },
            { label: 'Weekly', icon: '📅', action: onWeeklyReflection },
            { label: 'Semester', icon: '🎓', action: onSemesterReflection },
          ].map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={btn.action}
              className="game-panel py-3 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:border-violet-500/40 transition"
            >
              {btn.icon} {btn.label}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
