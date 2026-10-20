import { motion } from "framer-motion";
import { formatPercent } from "./chartHelpers";
import { BRAND } from "./chartTheme";

export default function ProgressBar({ label, fraction = 0, color = BRAND[500] }) {
  const pct = Math.max(0, Math.min(1, fraction || 0));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-300">
        <span>{label}</span>
        <span className="font-semibold text-slate-700 dark:text-slate-200">{formatPercent(pct)}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-brand-100 dark:bg-white/10 shadow-inner"
        role="img"
        aria-label={`${label}: ${formatPercent(pct)}`}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
