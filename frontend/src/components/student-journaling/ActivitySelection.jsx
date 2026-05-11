import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ACTIVITIES = [
  { id: 'assignment', icon: '📝', name: 'Assignment', sub: 'Submit & review work', type: 'assignment', xp: 30, difficulty: 'Medium' },
  { id: 'project', icon: '💻', name: 'Project Dev', sub: 'Build & code', type: 'project', xp: 40, difficulty: 'Hard' },
  { id: 'revision', icon: '📚', name: 'Lecture Revision', sub: 'Review notes & slides', type: 'revision', xp: 25, difficulty: 'Easy' },
  { id: 'internship', icon: '🏢', name: 'Internship', sub: 'Work tasks & reporting', type: 'assignment', xp: 35, difficulty: 'Medium' },
  { id: 'club', icon: '🎯', name: 'Club Activities', sub: 'Events & leadership', type: 'assignment', xp: 20, difficulty: 'Easy' },
  { id: 'lab', icon: '🔬', name: 'Lab Work', sub: 'Practicals & experiments', type: 'revision', xp: 30, difficulty: 'Medium' },
];

export default function ActivitySelection({ onContinue }) {
  const [selected, setSelected] = useState([]);
  const [missionNames, setMissionNames] = useState({});

  const toggle = (id) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const handleContinue = () => {
    const missions = selected.map(id => {
      const act = ACTIVITIES.find(a => a.id === id);
      return {
        id,
        name: missionNames[id] || act.name,
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
    <div className="min-h-screen px-5 py-8" style={{ background: '#0d0f1a' }}>
      <motion.div
        className="max-w-md mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-violet-400/70 mb-1">Step 1 of 2</p>
          <h1 className="text-2xl font-semibold text-slate-100">What did you work on?</h1>
          <p className="text-sm text-slate-500 mt-1">Select your activities to generate missions</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {ACTIVITIES.map((act, i) => {
            const isSelected = selected.includes(act.id);
            return (
              <motion.button
                key={act.id}
                className="relative text-left p-4 rounded-2xl border transition-colors"
                style={{
                  background: isSelected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                  borderColor: isSelected ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.07)',
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => toggle(act.id)}
              >
                {isSelected && (
                  <motion.div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{ boxShadow: '0 0 20px rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                )}
                <div className="text-2xl mb-2">{act.icon}</div>
                <p className="text-sm font-medium text-slate-200">{act.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{act.sub}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-violet-400">+{act.xp} XP</span>
                  <div
                    className="w-4 h-4 rounded-full border flex items-center justify-center transition-all"
                    style={{
                      borderColor: isSelected ? '#7c3aed' : 'rgba(255,255,255,0.15)',
                      background: isSelected ? '#7c3aed' : 'transparent',
                    }}
                  >
                    {isSelected && <span className="text-white text-[9px]">✓</span>}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence>
          {selected.length > 0 && (
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Name your missions (optional)</p>
              <div className="flex flex-col gap-2">
                {selected.map(id => {
                  const act = ACTIVITIES.find(a => a.id === id);
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <span className="text-lg flex-shrink-0">{act.icon}</span>
                      <input
                        type="text"
                        placeholder={`${act.name} mission name…`}
                        value={missionNames[id] || ''}
                        onChange={e => setMissionNames(p => ({ ...p, [id]: e.target.value }))}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-violet-500/50 transition-colors"
                      />
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          className="w-full py-4 rounded-2xl text-sm font-semibold border-0 transition-all"
          style={{
            background: selected.length > 0
              ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
              : 'rgba(255,255,255,0.04)',
            color: selected.length > 0 ? '#fff' : '#334155',
            cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
          }}
          whileHover={selected.length > 0 ? { scale: 1.01 } : {}}
          whileTap={selected.length > 0 ? { scale: 0.98 } : {}}
          onClick={selected.length > 0 ? handleContinue : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {selected.length === 0
            ? 'Select at least one activity'
            : `Generate ${selected.length} Mission${selected.length > 1 ? 's' : ''} →`}
        </motion.button>
      </motion.div>
    </div>
  );
}
