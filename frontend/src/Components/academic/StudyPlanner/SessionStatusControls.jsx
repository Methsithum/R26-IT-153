import { useState } from "react";
import { Check, X, Repeat } from "lucide-react";
import { useAcademicStore } from "../../../store/useAcademicStore";
import { DECISION_LABELS } from "../../../utils/sessionTracking";

/**
 * "Did you study in this session?" for one real scheduled session on today
 * or a past day. Marking it missed never moves anything - it only opens
 * the permission popup (MissedSessionModal), where the student chooses
 * this week / next week / don't reschedule.
 */
export default function SessionStatusControls({ sessionInput, record, compact = false }) {
  const userId = useAcademicStore((s) => s.userId);
  const markSessionStatus = useAcademicStore((s) => s.markSessionStatus);
  const openRescheduleModal = useAcademicStore((s) => s.openRescheduleModal);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  if (!userId) return null;

  const status = record?.status || "pending";
  // Once a missed session has been moved, its status is settled - the
  // student marks the NEW session instead (the backend enforces this too).
  const locked = !!record?.rescheduled_to;

  async function mark(next) {
    if (locked || saving || next === status) return;
    setSaving(next);
    setError(null);
    try {
      await markSessionStatus(sessionInput, next);
    } catch (e) {
      setError(e.message || "Couldn't save.");
    } finally {
      setSaving(null);
    }
  }

  const size = compact ? 10 : 12;
  const base = `inline-flex items-center gap-0.5 rounded-full font-semibold transition-colors disabled:opacity-50 ${
    compact ? "text-[9px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5"
  }`;

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => mark("done")}
          disabled={locked || !!saving}
          title="I studied in this session"
          className={`${base} ${
            status === "done"
              ? "bg-low-500 text-white"
              : "bg-white/70 dark:bg-white/10 text-low-600 hover:bg-low-50 dark:hover:bg-low-500/20"
          }`}
        >
          <Check size={size} /> {status === "done" ? "Studied" : "Did it"}
        </button>
        <button
          type="button"
          onClick={() => mark("missed")}
          disabled={locked || !!saving}
          title="I didn't study in this session"
          className={`${base} ${
            status === "missed"
              ? "bg-high-500 text-white"
              : "bg-white/70 dark:bg-white/10 text-high-600 hover:bg-high-50 dark:hover:bg-high-500/20"
          }`}
        >
          <X size={size} /> Missed
        </button>
      </div>

      {status === "missed" && record?.reschedule_decision && (
        record.reschedule_decision === "pending" ? (
          <button
            type="button"
            onClick={() => openRescheduleModal(record)}
            className={`${base} bg-medium-50 dark:bg-medium-500/15 text-medium-600 hover:opacity-80`}
          >
            <Repeat size={size} /> {DECISION_LABELS.pending}
          </button>
        ) : (
          <p className={`${compact ? "text-[9px]" : "text-[11px]"} text-slate-400 font-medium`}>
            {DECISION_LABELS[record.reschedule_decision]}
          </p>
        )
      )}

      {error && <p className="text-[10px] text-high-600">{error}</p>}
    </div>
  );
}
