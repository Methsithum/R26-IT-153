import { motion } from "framer-motion";
import { Brain, CalendarClock } from "lucide-react";
import ConfidenceMeter from "./ConfidenceMeter";

// Shows one priority explanation from resolveExplanationDisplay()
export default function ExplanationPanel({ display, confidence, loading }) {
  if (loading) {
    return (
      <div className="card p-4 animate-pulse space-y-2">
        <div className="h-4 w-1/2 bg-slate-100 dark:bg-white/10 rounded" />
        <div className="h-3 w-full bg-slate-100 dark:bg-white/10 rounded" />
        <div className="h-3 w-2/3 bg-slate-100 dark:bg-white/10 rounded" />
      </div>
    );
  }

  if (!display) return null;

  const isDeadlineOnly = display.type === "deadline";
  const Icon = isDeadlineOnly ? CalendarClock : Brain;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center">
          <Icon size={16} className="text-brand-500" />
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-white">Why this priority?</p>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-300 leading-relaxed">{display.sentence}</p>

      {/* Extra grounded detail */}
      {display.detail && (
        <p className="text-sm text-slate-500 dark:text-slate-300 leading-relaxed">{display.detail}</p>
      )}

      {/* Cold-start honesty caveat */}
      {display.caveat && (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic leading-relaxed">{display.caveat}</p>
      )}

      {!isDeadlineOnly && confidence != null && <ConfidenceMeter confidence={confidence} />}
    </motion.div>
  );
}
