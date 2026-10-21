import { useState } from "react";
import { Check, X, Repeat } from "lucide-react";
import { useAcademicStore } from "../../../store/useAcademicStore";
import { DECISION_LABELS } from "../../../utils/sessionTracking";

// "Did you study in this session?" for one real scheduled session on today or a past day.
export default function SessionStatusControls({ sessionInput, record, compact = false }) {
  const userId = useAcademicStore((s) => s.userId);
  const markSessionStatus = useAcademicStore((s) => s.markSessionStatus);
  const openRescheduleModal = useAcademicStore((s) => s.openRescheduleModal);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);
  // After "Studied" only that badge is shown
  const [changing, setChanging] = useState(false);

  if (!userId) return null;

  const status = record?.status || "pending";
  // Once a missed session has been moved, its status is settled
  const locked = !!record?.rescheduled_to;

  async function mark(next) {
    if (next === status) {
      setChanging(false);
      return;
    }
    if (locked || saving) return;
    setSaving(next);
    setError(null);
    try {
      await markSessionStatus(sessionInput, next);
      setChanging(false);
    } catch (e) {
      setError(e.message || "Couldn't save.");
    } finally {
      setSaving(null);
    }
  }

  // Sized as real tap targets
  const size = compact ? 13 : 15;
  const base = `inline-flex items-center justify-center gap-1 rounded-lg border font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-8 ${
    compact ? "text-xs px-2 py-1.5" : "text-sm px-3 py-2"
  }`;

  if (status === "done" && !changing) {
    return (
      <div className="mt-1.5 space-y-1">
        <div className={`${base} w-full bg-low-500 border-low-500 text-white`} role="status">
          <Check size={size} /> Studied
        </div>
        {!locked && (
          <button
            type="button"
            onClick={() => setChanging(true)}
            className={`${compact ? "text-[11px]" : "text-xs"} font-medium text-slate-500 dark:text-slate-300 underline underline-offset-2 hover:text-slate-700`}
          >
            Change
          </button>
        )}
        {error && <p className="text-[11px] text-high-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-1.5 space-y-1">
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => mark("done")}
          disabled={locked || !!saving}
          title="I studied in this session"
          className={`${base} ${
            status === "done"
              ? "bg-low-500 border-low-500 text-white"
              : "bg-white dark:bg-white/10 border-low-500/40 text-low-600 hover:bg-low-50 dark:hover:bg-low-500/20"
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
              ? "bg-high-500 border-high-500 text-white"
              : "bg-white dark:bg-white/10 border-high-500/40 text-high-600 hover:bg-high-50 dark:hover:bg-high-500/20"
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
            className={`${base} w-full border-medium-500/40 bg-medium-50 dark:bg-medium-500/15 text-medium-600 hover:opacity-80`}
          >
            <Repeat size={size} /> {DECISION_LABELS.pending}
          </button>
        ) : (
          <p className={`${compact ? "text-[11px]" : "text-xs"} text-slate-500 dark:text-slate-300 font-medium`}>
            {DECISION_LABELS[record.reschedule_decision]}
          </p>
        )
      )}

      {error && <p className="text-[11px] text-high-600">{error}</p>}
    </div>
  );
}
