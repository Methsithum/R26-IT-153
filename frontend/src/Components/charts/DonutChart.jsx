import { useState } from "react";
import { motion } from "framer-motion";
import { CATEGORICAL } from "./chartTheme";

/** segments: [{label, value, color?}] */
export default function DonutChart({ segments = [], size = 120, thickness = 16, emptyLabel = "No data yet" }) {
  const [hover, setHover] = useState(null);
  const total = segments.reduce((sum, s) => sum + (s.value || 0), 0);

  if (!segments.length || total <= 0) {
    return (
      <div style={{ width: size, height: size }} className="flex items-center justify-center rounded-full bg-brand-50/50 dark:bg-white/5 text-[10px] text-slate-400 text-center px-2">
        {emptyLabel}
      </div>
    );
  }

  const radius = size / 2 - thickness / 2;
  const circumference = 2 * Math.PI * radius;
  const segmentsWithOffset = segments.reduce((acc, s) => {
    const fraction = s.value / total;
    const cumulativeBefore = acc.length ? acc[acc.length - 1].cumulativeBefore + acc[acc.length - 1].fraction : 0;
    return [...acc, { ...s, fraction, cumulativeBefore }];
  }, []);

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(124,58,237,0.1)" strokeWidth={thickness} />
        {segmentsWithOffset.map((s, i) => {
          const dash = s.fraction * circumference;
          const offset = circumference * (1 - s.cumulativeBefore);
          const color = s.color || CATEGORICAL[i % CATEGORICAL.length];
          const isHover = hover === i;
          return (
            <motion.circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={isHover ? thickness + 3 : thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.7, delay: 0.1 * i, ease: "easeOut" }}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              tabIndex={0}
              role="img"
              aria-label={`${s.label}: ${Math.round(s.fraction * 100)}%`}
              style={{ cursor: "pointer" }}
            />
          );
        })}
      </svg>
      <ul className="space-y-1 text-[11px]">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1.5 text-slate-500 dark:text-slate-300">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color || CATEGORICAL[i % CATEGORICAL.length] }} />
            {s.label} ({Math.round(((s.value || 0) / total) * 100)}%)
          </li>
        ))}
      </ul>
    </div>
  );
}
