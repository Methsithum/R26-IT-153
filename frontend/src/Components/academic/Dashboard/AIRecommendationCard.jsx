import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { daysRemaining } from "../../../utils/dateHelpers";

// Synthesizes a friendly, encouraging recommendation from the module with the
// weakest grade + nearest deadline. This is a display-layer composition over
// data the ML pipeline already produced (priority predictions per task,
// module grades) - it reads as "helpful suggestion", never a command or a
// judgment of the student (PROJECT CONTEXT.md Section 10).
function pickRecommendation(modules, assignments) {
  const candidates = modules
    .map((m) => {
      const upcoming = assignments
        .filter((a) => a.module === m.code && a.status === "pending")
        .sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate))[0];
      if (!upcoming) return null;
      const days = daysRemaining(upcoming.deadlineDate);
      const urgencyScore = (100 - m.currentGrade) + Math.max(0, 14 - days) * 3;
      return { module: m, task: upcoming, days, urgencyScore };
    })
    .filter(Boolean)
    .sort((a, b) => b.urgencyScore - a.urgencyScore);

  return candidates[0] || null;
}

export default function AIRecommendationCard({ modules, assignments }) {
  const [dismissed, setDismissed] = useState(false);
  const rec = pickRecommendation(modules, assignments);

  if (dismissed || !rec) return null;

  const extraHours = rec.module.currentGrade < 70 ? 2 : 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative overflow-hidden rounded-3xl p-6 text-white shadow-playful bg-gradient-to-br from-brand-600 via-brand-500 to-accent-pink"
      >
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -right-4 bottom-0 w-24 h-24 rounded-full bg-white/10" />

        <button
          onClick={() => setDismissed(true)}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
          aria-label="Dismiss recommendation"
        >
          <X size={14} />
        </button>

        <div className="relative flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <p className="font-display font-bold">Smart Study Recommendation</p>
        </div>

        <p className="relative text-lg font-semibold leading-snug max-w-md">
          Give {rec.module.name} a little extra attention this week.
        </p>
        <p className="relative text-sm text-white/85 mt-2 max-w-md leading-relaxed">
          Your recent grade there is {rec.module.currentGrade}%, and{" "}
          <span className="font-semibold">{rec.task.title}</span> is due in {Math.max(rec.days, 0)} day
          {rec.days === 1 ? "" : "s"} — a bit more time now should make it feel much more manageable.
        </p>

        <div className="relative flex flex-wrap items-center gap-3 mt-5">
          <span className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1.5 text-sm font-semibold">
            + {extraHours} hours suggested this week
          </span>
          <Link
            to="/study-planner"
            className="inline-flex items-center gap-1.5 bg-white text-brand-600 font-semibold text-sm rounded-full px-4 py-2 hover:bg-white/90 transition-colors"
          >
            View Study Plan <ArrowRight size={15} />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="text-sm font-medium text-white/80 hover:text-white transition-colors px-2"
          >
            Dismiss
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
