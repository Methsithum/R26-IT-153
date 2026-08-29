import { motion } from "framer-motion";
import { Brain, CalendarClock } from "lucide-react";
import { humanizeContributions } from "../../../utils/featureNameMap";
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

  // Direction here means "pushed toward the predicted label", not
  // "good"/"bad" - a positive push toward a Low-priority prediction is
  // reassuring, not concerning. Use neutral brand/teal instead of
  // high/low priority colors so the bars don't accidentally imply a
  // universal good/bad judgment (Section 10 honesty principle).
  const contributions = display.contributions ? humanizeContributions(display.contributions).slice(0, 4) : [];

  // Bar length is relative to the LARGEST contribution actually shown in
  // this panel, not some arbitrary fixed multiplier - a previous version
  // used `Math.abs(value) * 220`, which clips to the 100% cap for almost
  // any real SHAP value (they're typically 0.3-0.9 in this model), so a
  // 0.05 contribution and a 0.88 contribution rendered as visually
  // near-identical bars. humanizeContributions() already sorts by |value|
  // descending, so contributions[0] IS the max - both the SHAP-only and
  // blended cases share this same rendering path, so the fix applies to
  // both automatically. Guard against an all-zero set (e.g. has_vle_activity
  // dominating a degenerate row) to avoid a 0/0 divide.
  const maxAbsContribution = contributions.length > 0 ? Math.abs(contributions[0].value) : 0;
  const barWidthPercent = (value) =>
    maxAbsContribution > 0 ? (Math.abs(value) / maxAbsContribution) * 100 : 0;

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

      {contributions.length > 0 && (
        <div className="space-y-2">
          {contributions.map((c) => (
            <div key={c.key} className="flex items-center gap-2 text-xs">
              <span className="w-36 shrink-0 text-slate-500 dark:text-slate-400 leading-tight">{c.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full ${c.direction === "increased" ? "bg-brand-500" : "bg-accent-teal"}`}
                  style={{ width: `${barWidthPercent(c.value)}%` }}
                />
              </div>
              <span className="shrink-0 font-medium text-slate-400" title={c.direction === "increased" ? "Pushed toward this priority" : "Pushed away from this priority"}>
                {c.direction === "increased" ? "↑" : "↓"}
              </span>
            </div>
          ))}
        </div>
      )}

      {!isDeadlineOnly && confidence != null && <ConfidenceMeter confidence={confidence} />}
    </motion.div>
  );
}
