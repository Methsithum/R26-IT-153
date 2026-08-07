import { motion } from 'framer-motion';

export default function XPBar({ current, max, level, dark = false }) {
  const pct = Math.min((current / max) * 100, 100);
  const labelColor = dark ? '#c4b5fd' : '#7e22ce';
  const textColor = dark ? '#94a3b8' : '#64748b';
  const trackBg = dark ? 'rgba(255,255,255,0.08)' : '#f1f5f9';

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center border"
            style={{
              background: dark ? 'rgba(139,92,246,0.2)' : '#f3e8ff',
              borderColor: dark ? 'rgba(139,92,246,0.4)' : '#e9d5ff',
            }}
          >
            <span className="text-xs font-bold" style={{ color: labelColor }}>{level}</span>
          </div>
          <span className="text-xs font-medium tracking-widest uppercase" style={{ color: labelColor }}>XP Progress</span>
        </div>
        <span className="text-xs font-mono" style={{ color: textColor }}>{current.toLocaleString()} / {max.toLocaleString()}</span>
      </div>
      <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: trackBg }}>
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
        <span className="text-[10px]" style={{ color: textColor }}>{Math.round(pct)}% complete</span>
        <span className="text-[10px]" style={{ color: textColor }}>{(max - current).toLocaleString()} XP to next level</span>
      </div>
    </div>
  );
}
