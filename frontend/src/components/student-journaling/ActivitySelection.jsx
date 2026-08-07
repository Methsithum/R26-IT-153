import { useState } from 'react';
import { motion } from 'framer-motion';

const ACTIVITIES = [
  { id: 'revision', icon: '📚', name: 'Lecture Revision', sub: 'Review notes, slides & past papers', type: 'revision', xp: 25, difficulty: 'Easy' },
  { id: 'assignment', icon: '📝', name: 'Assignment', sub: 'Submit & review coursework', type: 'assignment', xp: 30, difficulty: 'Medium' },
  { id: 'project', icon: '💻', name: 'Project Development', sub: 'Build, code & iterate', type: 'project', xp: 40, difficulty: 'Hard' },
  { id: 'internship', icon: '🏢', name: 'Internship', sub: 'Work tasks & professional growth', type: 'internship', xp: 35, difficulty: 'Medium' },
  { id: 'sports', icon: '⚽', name: 'Sports', sub: 'Training, matches & fitness', type: 'sports', xp: 20, difficulty: 'Easy' },
  { id: 'club', icon: '🎭', name: 'Club / Events', sub: 'Clubs, events & leadership', type: 'club', xp: 20, difficulty: 'Easy' },
];

export default function ActivitySelection({ onContinue, onBack }) {
  const [selected, setSelected] = useState([]);

  const toggle = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const handleContinue = () => {
    const missions = selected.map((id) => {
      const act = ACTIVITIES.find((a) => a.id === id);
      return {
        id,
        name: act.name,
        subject: act.name,
        type: act.type,
        xp: act.xp,
        difficulty: act.difficulty,
        status: 'active',
        icon: act.icon,
        progress: 0,
      };
    });
    onContinue(missions);
  };

  return (
    <div className="min-h-screen game-bg px-4 py-8 sm:px-8">
      <motion.div className="mx-auto max-w-3xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {onBack && (
          <button type="button" onClick={onBack} className="text-sm text-slate-500 hover:text-slate-300 mb-6">
            ← Back
          </button>
        )}

        <p className="text-[10px] uppercase tracking-widest text-violet-400 mb-2">Daily Adventure</p>
        <h1 className="text-3xl font-bold text-white mb-2">What did you do today?</h1>
        <p className="text-slate-400 text-sm mb-8">Select all activities — each becomes a unique 3D map</p>

        <div className="grid grid-cols-1 gap-3 mb-8 sm:grid-cols-2">
          {ACTIVITIES.map((act, i) => {
            const isSelected = selected.includes(act.id);
            return (
              <motion.button
                key={act.id}
                type="button"
                className="relative text-left p-5 rounded-2xl border transition-all"
                style={{
                  background: isSelected ? 'rgba(139,92,246,0.15)' : 'rgba(15,23,42,0.6)',
                  borderColor: isSelected ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)',
                }}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.02, borderColor: 'rgba(139,92,246,0.4)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => toggle(act.id)}
              >
                {isSelected && (
                  <motion.div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{ boxShadow: '0 0 30px rgba(139,92,246,0.2)' }}
                    layoutId={`glow-${act.id}`}
                  />
                )}
                <div className="text-3xl mb-3">{act.icon}</div>
                <p className="text-sm font-semibold text-white">{act.name}</p>
                <p className="text-xs text-slate-400 mt-1">{act.sub}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] text-amber-400">+{act.xp} XP</span>
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: isSelected ? '#8b5cf6' : '#475569',
                      background: isSelected ? '#8b5cf6' : 'transparent',
                    }}
                  >
                    {isSelected && <span className="text-white text-[10px]">✓</span>}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <motion.button
          type="button"
          className="game-btn-primary w-full py-4 rounded-2xl font-bold disabled:opacity-40"
          disabled={selected.length === 0}
          whileHover={selected.length > 0 ? { scale: 1.01 } : {}}
          whileTap={selected.length > 0 ? { scale: 0.98 } : {}}
          onClick={selected.length > 0 ? handleContinue : undefined}
        >
          {selected.length === 0 ? 'Select at least one activity' : `🗺️ BUILD MY ADVENTURE (${selected.length})`}
        </motion.button>
      </motion.div>
    </div>
  );
}

export { ACTIVITIES };
