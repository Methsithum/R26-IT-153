import { motion } from 'framer-motion';

const STATUS_STYLES = {
  done: {
    dot: '#22c55e',
    glow: 'rgba(34,197,94,0.4)',
    badge: { bg: 'rgba(34,197,94,0.12)', color: '#4ade80', border: 'rgba(34,197,94,0.25)' },
    label: 'Complete',
  },
  active: {
    dot: '#7c3aed',
    glow: 'rgba(124,58,237,0.5)',
    badge: { bg: 'rgba(124,58,237,0.18)', color: '#c4b5fd', border: 'rgba(124,58,237,0.35)' },
    label: 'Active',
  },
  locked: {
    dot: '#334155',
    glow: 'transparent',
    badge: { bg: 'rgba(255,255,255,0.05)', color: '#475569', border: 'rgba(255,255,255,0.08)' },
    label: 'Locked',
  },
};

export default function MissionCard({ mission, index, onClick }) {
  const s = STATUS_STYLES[mission.status] || STATUS_STYLES.locked;
  const isLocked = mission.status === 'locked';

  return (
    <motion.div
      className="relative flex items-center gap-3 rounded-xl px-4 py-3.5 border cursor-pointer group"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.07)',
        opacity: isLocked ? 0.5 : 1,
      }}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: isLocked ? 0.5 : 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      whileHover={!isLocked ? { x: 4, background: 'rgba(255,255,255,0.055)' } : {}}
      onClick={!isLocked ? onClick : undefined}
    >
      <motion.div
        className="w-2 h-2 rounded-full"
        style={{ flexShrink: 0, background: s.dot, boxShadow: mission.status === 'active' ? `0 0 8px ${s.glow}` : 'none' }}
        animate={mission.status === 'active' ? { boxShadow: [`0 0 5px ${s.glow}`, `0 0 14px ${s.glow}`, `0 0 5px ${s.glow}`] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 font-medium truncate">{mission.name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{mission.subject}</p>
      </div>
      <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
        <span className="text-xs font-medium" style={{ color: s.badge.color }}>
          {mission.status === 'done' ? `+${mission.xp} XP` : `+${mission.xp} XP`}
        </span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-md border font-medium"
          style={{ background: s.badge.bg, color: s.badge.color, borderColor: s.badge.border }}
        >
          {s.label}
        </span>
      </div>
      {!isLocked && (
        <motion.div
          className="text-slate-600 group-hover:text-slate-400 ml-1"
          animate={{ x: [0, 3, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          →
        </motion.div>
      )}
    </motion.div>
  );
}
