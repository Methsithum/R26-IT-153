import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CalendarClock, CalendarPlus, Ban, ArrowLeft, Star, AlertTriangle, Loader2 } from "lucide-react";
import { useAcademicStore } from "../../../store/useAcademicStore";
import { suggestSlots } from "../../../services/academicApi";
import { buildOccupiedByDate } from "../../../utils/sessionTracking";
import { withExamDaysOccupied } from "../../../utils/examDay";
import { formatFriendlyDate } from "../../../utils/dateHelpers";
import { resolveSessionDisplay } from "../../../utils/studySessionBuilder";

const WARNING_COPY = {
  deadline_passed: "The deadline for this task has already passed, so it can't be rescheduled.",
  deadline_before_next_week: "The deadline is before next week, so this has to happen this week.",
  no_slot_before_deadline: "There's no free time left in this week before the deadline.",
  only_partial_slots: "No free slot is long enough for the whole session - these shorter slots would cover part of it.",
};

/**
 * Permission-first popup for a missed session. Nothing is scheduled until
 * the student picks: add it this week, move it to next week, or leave it
 * missed. "This week"/"next week" then shows real free slots (cut off at
 * the deadline) and only the slot they confirm is booked. Closing the
 * popup leaves the decision pending - it shows up again in the Study
 * Planner's "needs a decision" banner.
 */
export default function MissedSessionModal() {
  const target = useAcademicStore((s) => s.rescheduleTarget);
  const close = useAcademicStore((s) => s.closeRescheduleModal);

  return (
    <AnimatePresence>
      {target && <ModalBody key={target.id} target={target} onClose={close} />}
    </AnimatePresence>
  );
}

function ModalBody({ target, onClose }) {
  const userId = useAcademicStore((s) => s.userId);
  const weeklyFreeSlots = useAcademicStore((s) => s.weeklyFreeSlots);
  const scheduleResponse = useAcademicStore((s) => s.scheduleResponse);
  const multiWeekSchedule = useAcademicStore((s) => s.multiWeekSchedule);
  const modules = useAcademicStore((s) => s.modules);
  const assignments = useAcademicStore((s) => s.assignments);
  const exams = useAcademicStore((s) => s.exams);
  const confirmReschedule = useAcademicStore((s) => s.confirmReschedule);
  const declineSessionReschedule = useAcademicStore((s) => s.declineSessionReschedule);

  const [step, setStep] = useState("choose"); // "choose" | "slots"
  const [week, setWeek] = useState(null);
  const [result, setResult] = useState(null); // SuggestSlotsResponse for `week`
  const [options, setOptions] = useState(null); // expired / can_use_this_week / can_use_next_week
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);

  const moduleName = (code) => modules.find((m) => m.code === code)?.name || code;
  const display = resolveSessionDisplay(target, {
    tasksRegistry: { [target.task_id]: { task_type: target.task_type, deadline_date: target.deadline_date } },
    assignments,
    moduleName,
    exams,
  });

  async function load(whichWeek) {
    setBusy(true);
    setError(null);
    try {
      const res = await suggestSlots(target.id, {
        userId,
        week: whichWeek,
        weeklyFreeSlots,
        // Exam days are never offered - nothing is scheduled on an exam day.
        occupied: withExamDaysOccupied(buildOccupiedByDate(whichWeek, { scheduleResponse, multiWeekSchedule }), exams),
      });
      setOptions({ expired: res.expired, can_use_this_week: res.can_use_this_week, can_use_next_week: res.can_use_next_week });
      setResult(res);
      setSelected(res.suggestions.find((s) => s.recommended) || null);
      return res;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  // Preload "this week" once on open - its response also carries which of
  // the three choices the real deadline allows.
  useEffect(() => {
    load("this");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.id]);

  async function chooseWeek(whichWeek) {
    setWeek(whichWeek);
    setStep("slots");
    if (whichWeek !== "this" || !result || result.week !== "this") await load(whichWeek);
  }

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await confirmReschedule(target, {
        week,
        weeklyFreeSlots,
        occupied: withExamDaysOccupied(buildOccupiedByDate(week, { scheduleResponse, multiWeekSchedule }), exams),
        date: selected.date,
        timeSlot: selected.time_slot,
      });
    } catch (e) {
      // Most likely 409: the slot was taken after it was suggested - refresh the list.
      setError(e.message);
      await load(week);
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setError(null);
    try {
      await declineSessionReschedule(target);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const deadlineLabel = result?.deadline_date ? formatFriendlyDate(result.deadline_date) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        className="card w-full max-w-md p-5 max-h-[85vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="missed-session-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-high-600">Missed session</p>
            <h2 id="missed-session-title" className="font-display font-bold text-lg text-slate-800 dark:text-white leading-snug">
              {display.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
              {formatFriendlyDate(target.date)} · {target.time_slot} · {target.duration_minutes} min
              {deadlineLabel && <> · Deadline <span className="font-semibold">{deadlineLabel}</span></>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Decide later"
            title="Decide later"
            className="w-8 h-8 shrink-0 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-slate-400"
          >
            <X size={16} />
          </button>
        </div>

        {step === "choose" && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-white">What do you want to do with this session?</p>
            {busy && !options ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-6 justify-center">
                <Loader2 size={14} className="animate-spin" /> Checking your deadline and free time…
              </div>
            ) : (
              <>
                {options?.expired && <Notice text={WARNING_COPY.deadline_passed} />}
                <ChoiceButton
                  icon={CalendarClock}
                  label="Add it this week"
                  disabled={!options?.can_use_this_week}
                  onClick={() => chooseWeek("this")}
                />
                <ChoiceButton
                  icon={CalendarPlus}
                  label="Move it to next week"
                  hint={options && !options.can_use_next_week && !options.expired ? `Deadline is ${deadlineLabel} - it has to be this week.` : null}
                  disabled={!options?.can_use_next_week}
                  onClick={() => chooseWeek("next")}
                />
                <ChoiceButton
                  icon={Ban}
                  label="Don't reschedule - leave it missed"
                  hint={deadlineLabel && !options?.expired ? `You'll have ${target.duration_minutes} min less study time before ${deadlineLabel}.` : null}
                  disabled={busy}
                  onClick={decline}
                  tone="muted"
                />
              </>
            )}
          </div>
        )}

        {step === "slots" && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setStep("choose")}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-brand-600 mb-2"
            >
              <ArrowLeft size={13} /> Back
            </button>
            <p className="text-sm font-semibold text-slate-700 dark:text-white mb-2">
              Pick a free slot {week === "this" ? "this week" : "next week"}
            </p>

            {busy ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-6 justify-center">
                <Loader2 size={14} className="animate-spin" /> Finding free slots…
              </div>
            ) : (
              <>
                {result?.warning && <Notice text={WARNING_COPY[result.warning]} />}
                <div className="space-y-1.5 mt-2" role="radiogroup">
                  {(result?.suggestions || []).map((s) => {
                    const isSelected = selected?.date === s.date && selected?.time_slot === s.time_slot;
                    return (
                      <button
                        key={`${s.date}-${s.time_slot}`}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSelected(s)}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left border transition-colors ${
                          isSelected
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-500/15"
                            : "border-slate-200 dark:border-white/10 hover:border-brand-300"
                        }`}
                      >
                        <span className="text-sm font-semibold text-slate-700 dark:text-white">
                          {formatFriendlyDate(s.date)} · {s.time_slot}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          {!s.fits && <span className="text-[10px] font-medium text-medium-600">{s.duration_minutes} min</span>}
                          {s.recommended && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-brand-600">
                              <Star size={10} /> Recommended
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-300 rounded-2xl px-4 py-2"
              >
                Decide later
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!selected || busy}
                className="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-2xl px-4 py-2 disabled:opacity-50"
              >
                Confirm slot
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-high-600">{error}</p>}
      </motion.div>
    </motion.div>
  );
}

function ChoiceButton({ icon: Icon, label, hint, disabled, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-start gap-3 rounded-2xl px-4 py-3 text-left border transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
        tone === "muted"
          ? "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
          : "border-brand-200 dark:border-brand-500/30 hover:bg-brand-50 dark:hover:bg-brand-500/10"
      }`}
    >
      <Icon size={18} className={tone === "muted" ? "text-slate-400 mt-0.5" : "text-brand-600 mt-0.5"} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-700 dark:text-white">{label}</span>
        {hint && <span className="block text-[11px] text-slate-400 mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

function Notice({ text }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-medium-50 dark:bg-medium-500/10 px-3 py-2 text-xs text-medium-600">
      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}
