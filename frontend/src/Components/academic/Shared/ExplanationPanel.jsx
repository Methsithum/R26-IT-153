import { motion } from "framer-motion";
import { Brain, CalendarClock } from "lucide-react";
import { humanizeContributions } from "../../../utils/featureNameMap";
import ConfidenceMeter from "./ConfidenceMeter";

// deadlineSentence (from priorityEngine.js's deadlineDominantSentence) is
// non-null exactly when the rule-based deadline layer (PROJECT CONTEXT.md
// Section 5d) - not the ML model - determined the displayed priority. In
// that case the SHAP feature-contribution bars below would be explaining a
// DIFFERENT label than the one on screen (the model's raw prediction, which
// the deadline layer overrode), so showing both would blend two different
// explanations into one misleading picture. Show exactly one.
export default function ExplanationPanel({ explanation, confidence, loading, deadlineSentence }) {
  if (loading) {
    return (
      <div className="card p-4 animate-pulse space-y-2">
        <div className="h-4 w-1/2 bg-slate-100 dark:bg-white/10 rounded" />
        <div className="h-3 w-full bg-slate-100 dark:bg-white/10 rounded" />
        <div className="h-3 w-2/3 bg-slate-100 dark:bg-white/10 rounded" />
      </div>
    );
  }

  if (deadlineSentence) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center">
            <CalendarClock size={16} className="text-brand-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-white">Why this priority?</p>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-300 leading-relaxed">{deadlineSentence}</p>
      </motion.div>
    );
  }

  if (!explanation) return null;

  // Direction here means "pushed toward the predicted label", not
  // "good"/"bad" - a positive push toward a Low-priority prediction is
  // reassuring, not concerning. Use neutral brand/teal instead of
  // high/low priority colors so the bars don't accidentally imply a
  // universal good/bad judgment (Section 10 honesty principle).
  const contributions = humanizeContributions(explanation.feature_contributions).slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center">
          <Brain size={16} className="text-brand-500" />
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-white">Why this priority?</p>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-300 leading-relaxed">{explanation.explanation_sentence}</p>

      <div className="space-y-2">
        {contributions.map((c) => (
          <div key={c.key} className="flex items-center gap-2 text-xs">
            <span className="w-32 shrink-0 text-slate-500 dark:text-slate-400 truncate">{c.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full ${c.direction === "increased" ? "bg-brand-500" : "bg-accent-teal"}`}
                style={{ width: `${Math.min(100, Math.abs(c.value) * 220)}%` }}
              />
            </div>
            <span className="shrink-0 font-medium text-slate-400" title={c.direction === "increased" ? "Pushed toward this priority" : "Pushed away from this priority"}>
              {c.direction === "increased" ? "↑" : "↓"}
            </span>
          </div>
        ))}
      </div>

      {confidence != null && <ConfidenceMeter confidence={confidence} />}
    </motion.div>
  );
}
