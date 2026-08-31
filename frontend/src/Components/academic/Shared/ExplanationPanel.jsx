import { motion } from "framer-motion";
import { Brain, CalendarClock } from "lucide-react";
import ConfidenceMeter from "./ConfidenceMeter";

// `display` is the resolved output of priorityEngine.js's
// resolveExplanationDisplay() - { type: "shap"|"deadline"|"blended",
// sentence, contributions? } - never the raw /explain response. That
// function is what decides which mechanism actually produced the priority
// on screen (the badge reflects the FINAL, post-priorityEngine label, which
// can differ from /explain's raw ML prediction - see PROJECT CONTEXT.md
// Section 6 follow-up) and builds every sentence through the humanizer
// (featureNameMap.js), so no raw model feature name (e.g.
// "assessment_type_enc") or explanation for a label the student isn't
// looking at can reach this component. Show exactly one sentence - never
// blend a SHAP sentence and a deadline sentence together, since they can
// legitimately describe different things.
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

      {/* Extra grounded detail (priorityEngine.js's weightDetailSentence) -
          only present when the named reason was assignment weight, and only
          ever cites the REAL percentile stats from the actual training
          dataset, never a made-up comparison. A separate paragraph, not
          appended into `sentence`, so the headline reason stays a single
          clean sentence and this reads as "here's the real number behind
          that", not as the same claim restated. */}
      {display.detail && (
        <p className="text-sm text-slate-500 dark:text-slate-300 leading-relaxed">{display.detail}</p>
      )}

      {/* Cold-start honesty caveat (Section 17) - only present when
          prior_avg_score would otherwise have been named as the headline
          reason but is actually a neutral no-data fallback, not a real
          recorded average for this student. Separate line, not merged into
          `sentence`, so it reads as a clarifying note rather than part of
          the main explanation. */}
      {display.caveat && (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic leading-relaxed">{display.caveat}</p>
      )}

      {!isDeadlineOnly && confidence != null && <ConfidenceMeter confidence={confidence} />}
    </motion.div>
  );
}
