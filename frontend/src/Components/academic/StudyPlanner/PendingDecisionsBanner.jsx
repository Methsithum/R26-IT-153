import { Repeat } from "lucide-react";
import { useAcademicStore } from "../../../store/useAcademicStore";

/** Missed sessions whose popup was closed without a choice - nothing moves until the student decides. */
export default function PendingDecisionsBanner() {
  const pendingDecisions = useAcademicStore((s) => s.pendingDecisions);
  const openRescheduleModal = useAcademicStore((s) => s.openRescheduleModal);

  if (!pendingDecisions.length) return null;
  const count = pendingDecisions.length;

  return (
    <div className="card p-4 border-l-4 border-medium-500 bg-medium-50/60 dark:bg-medium-500/10 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <p className="text-sm font-semibold text-medium-600">
          {count} missed session{count === 1 ? "" : "s"} need{count === 1 ? "s" : ""} a decision
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
          Choose to add {count === 1 ? "it" : "them"} this week, move to next week, or leave as missed.
        </p>
      </div>
      <button
        type="button"
        onClick={() => openRescheduleModal(pendingDecisions[0])}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-medium-500 hover:opacity-90 rounded-full px-4 py-2"
      >
        <Repeat size={14} /> Decide now
      </button>
    </div>
  );
}
