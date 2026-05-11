import { motion } from 'framer-motion';

const RANKS = [
  { min: 1, max: 4, title: 'Freshman', color: '#64748b', glow: 'rgba(100,116,139,0.3)' },
  { min: 5, max: 9, title: 'Scholar', color: '#7c3aed', glow: 'rgba(124,58,237,0.4)' },
  { min: 10, max: 14, title: 'Achiever', color: '#0ea5e9', glow: 'rgba(14,165,233,0.4)' },
  { min: 15, max: 19, title: 'Master', color: '#f97316', glow: 'rgba(249,115,22,0.4)' },
  { min: 20, max: 99, title: 'Legend', color: '#eab308', glow: 'rgba(234,179,8,0.4)' },
];

export default function LevelCard({ level, name, department, year }) {
  const rank = RANKS.find(r => level >= r.min && level <= r.max) || RANKS[0];

  return (
    <div className="relative overflow-hidden">
      <div className="flex justify-between items-start">
        <div>
          <motion.div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-2 text-xs font-medium border"
            style={{
              background: `${rank.color}22`,
              borderColor: `${rank.color}44`,
              color: rank.color,
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <span>⚡</span>
            <span>Level {level} · {rank.title}</span>
          </motion.div>
          <motion.h2
            className="text-2xl font-semibold text-slate-100 tracking-tight"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            {name}
          </motion.h2>
          <motion.p
            className="text-xs mt-0.5 font-medium tracking-wider"
            style={{ color: rank.color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {department} · Year {year}
          </motion.p>
        </div>

        <motion.div
          className="relative w-14 h-14 rounded-2xl flex items-center justify-center border text-2xl font-bold"
          style={{
            background: `${rank.color}18`,
            borderColor: `${rank.color}40`,
            color: rank.color,
            boxShadow: `0 0 20px ${rank.glow}`,
          }}
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', delay: 0.25, stiffness: 200 }}
          whileHover={{ scale: 1.05 }}
        >
          {level}
          <motion.div
            className="absolute inset-0 rounded-2xl"
            style={{ background: `${rank.color}10` }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
        </motion.div>
      </div>
    </div>
  );
}
