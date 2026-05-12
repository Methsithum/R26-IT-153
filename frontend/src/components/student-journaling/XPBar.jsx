import { motion } from 'framer-motion';

export default function XPBar({ current, max, level }) {
  const pct = Math.min((current / max) * 100, 100);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center">
            <span className="text-xs font-bold text-purple-700">{level}</span>
          </div>
          <span className="text-xs font-medium text-purple-700 tracking-widest uppercase">XP Progress</span>
        </div>
        <span className="text-xs text-slate-600 font-mono">{current.toLocaleString()} / {max.toLocaleString()}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: 'linear-gradient(90deg, #3b82f6, #a855f7, #10b981)' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
        <motion.div
          className="absolute inset-y-0 rounded-full opacity-60"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)', width: '40%' }}
          animate={{ left: ['-40%', '140%'] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-slate-600">{Math.round(pct)}% complete</span>
        <span className="text-[10px] text-slate-600">{(max - current).toLocaleString()} XP to next level</span>
      </div>
    </div>
  );
}
