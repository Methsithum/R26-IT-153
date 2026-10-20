import { GraduationCap } from "lucide-react";
import { useAcademicStore } from "../../../store/useAcademicStore";
import { examClusters, clusterNeedsDecision } from "../../../utils/examDay";
import { formatFriendlyDate } from "../../../utils/dateHelpers";

/** Back-to-back exams the student hasn't set up yet - exam days stay fully free until they answer. */
export default function ExamClusterBanner() {
  const exams = useAcademicStore((s) => s.exams);
  const openExamPlan = useAcademicStore((s) => s.openExamPlan);

  const cluster = examClusters(exams).find(clusterNeedsDecision);
  if (!cluster) return null;

  return (
    <div className="card p-4 border-l-4 border-blue-500 bg-blue-50/60 dark:bg-blue-500/10 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-200">
          Back-to-back exams: {cluster.dates.map(formatFriendlyDate).join(", ")}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
          Tell us when each exam is, and whether you'd like a short revision after each one for the next day's exam.
        </p>
      </div>
      <button
        type="button"
        onClick={() => openExamPlan(cluster)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full px-4 py-2"
      >
        <GraduationCap size={14} /> Set up
      </button>
    </div>
  );
}
