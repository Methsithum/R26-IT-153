import { useId } from "react";
import { motion } from "framer-motion";
import { BRAND } from "./chartTheme";

export default function RadialGauge({ value = 0, max = 100, size = 84, color = BRAND[500], label }) {
  const clamped = Math.max(0, Math.min(1, max ? value / max : 0));
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const gradientId = useId();

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label || "value"}: ${Math.round(clamped * 100)}%`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={BRAND[300]} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(124,58,237,0.12)" strokeWidth={6} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="52%" textAnchor="middle" fontSize={size * 0.22} fontWeight={800} fill={BRAND[700]}>
          {Math.round(clamped * 100)}%
        </text>
      </svg>
      {label && <div className="text-[10px] font-medium text-slate-400">{label}</div>}
    </div>
  );
}
