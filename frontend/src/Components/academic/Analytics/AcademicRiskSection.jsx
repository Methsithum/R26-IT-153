import { HeartHandshake } from "lucide-react";
import { formatDeadlineCopy } from "../../../utils/dateHelpers";

// Framed as a recommendation, never a diagnostic label of the student
// (PROJECT CONTEXT.md Section 13 "Academic Risk/Warning section").
export default function AcademicRiskSection({ modules }) {
  // hasGradeData is false for a real module with no marks recorded yet
  // (currentGrade sits at a placeholder 0 in that case) — never flag "no
  // data yet" as if it were a genuine low grade.
  const flagged = modules.filter((m) => m.hasGradeData !== false && m.currentGrade < 70);

  if (flagged.length === 0) {
    return (
      <div className="card p-5 flex items-center gap-3 bg-low-50 dark:bg-low-500/10">
        <HeartHandshake className="text-low-600" size={20} />
        <p className="text-sm text-low-700 dark:text-low-500">All modules look on track — nice work keeping up!</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <p className="font-display font-bold text-slate-800 dark:text-white mb-1">Academic Attention Recommended</p>
      <p className="text-xs text-slate-400 mb-4">A few gentle suggestions based on recent performance — not a judgment, just a nudge.</p>
      <div className="space-y-2.5">
        {flagged.map((m) => (
          <div key={m.code} className="flex items-center justify-between bg-medium-50 dark:bg-medium-500/10 rounded-2xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-white">{m.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-300">
                {m.currentGrade}%{m.nextDeadline ? ` · deadline ${formatDeadlineCopy(m.nextDeadline).toLowerCase()}` : ""}
              </p>
            </div>
            <span className="text-xs font-bold text-medium-600 bg-white dark:bg-white/10 rounded-full px-3 py-1">
              Recommended: +{m.currentGrade < 60 ? 3 : 2}h
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
