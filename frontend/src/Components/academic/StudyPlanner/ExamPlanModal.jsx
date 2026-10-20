import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, GraduationCap, Loader2 } from "lucide-react";
import { useAcademicStore } from "../../../store/useAcademicStore";
import { formatFriendlyDate } from "../../../utils/dateHelpers";
import { EXAM_SESSION_TIMES, MAX_REVISION_MINUTES, REVISION_BUFFER_MINUTES } from "../../../utils/examDay";

/**
 * Asked ONCE per run of back-to-back exams: when each exam is (morning /
 * afternoon - the times are derived from that), and whether a short
 * revision session may be added after each exam for the next day's one.
 * Until answered, every exam day stays completely free.
 */
export default function ExamPlanModal() {
  const cluster = useAcademicStore((s) => s.examPlanCluster);
  const close = useAcademicStore((s) => s.closeExamPlan);
  return (
    <AnimatePresence>
      {cluster && <ModalBody key={cluster.dates.join(",")} cluster={cluster} onClose={close} />}
    </AnimatePresence>
  );
}

function ModalBody({ cluster, onClose }) {
  const modules = useAcademicStore((s) => s.modules);
  const saveExamPlans = useAcademicStore((s) => s.saveExamPlans);
  const moduleName = (code) => modules.find((m) => m.code === code)?.name || code;

  const [sessions, setSessions] = useState(() => Object.fromEntries(cluster.exams.map((e) => [e.id, e.examSession || null])));
  const [allowRevision, setAllowRevision] = useState(() => {
    const answered = cluster.exams.map((e) => e.afterExamRevision).filter((v) => v != null);
    return answered.length ? answered.every(Boolean) : null;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const ready = cluster.exams.every((e) => sessions[e.id]) && allowRevision != null;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveExamPlans(
        cluster.exams.map((e) => ({ examId: e.id, examSession: sessions[e.id], afterExamRevision: allowRevision }))
      );
    } catch (e) {
      setError(e.message || "Couldn't save.");
      setSaving(false);
    }
  }

  const dateList = cluster.dates.map(formatFriendlyDate).join(", ");

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
        aria-labelledby="exam-plan-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600 flex items-center gap-1">
              <GraduationCap size={13} /> Back-to-back exams
            </p>
            <h2 id="exam-plan-title" className="font-display font-bold text-lg text-slate-800 dark:text-white leading-snug">
              Exams on {dateList}
            </h2>
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

        <p className="text-sm font-semibold text-slate-700 dark:text-white mt-4">When is each exam?</p>
        <div className="mt-2 space-y-2">
          {cluster.exams.map((exam) => (
            <div key={exam.id} className="flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 dark:text-white truncate">
                  {exam.moduleName || moduleName(exam.module)}
                </p>
                <p className="text-[11px] text-slate-400">{formatFriendlyDate(exam.date)}</p>
              </div>
              <div className="flex gap-1" role="radiogroup" aria-label={`Time of ${exam.moduleName || exam.module} exam`}>
                {Object.entries(EXAM_SESSION_TIMES).map(([key, t]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={sessions[exam.id] === key}
                    onClick={() => setSessions((s) => ({ ...s, [exam.id]: key }))}
                    className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                      sessions[exam.id] === key
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-blue-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm font-semibold text-slate-700 dark:text-white mt-5">
          Add a short revision after each exam for the next day's exam?
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Starts {REVISION_BUFFER_MINUTES} min after the exam ends, inside your free time, max {MAX_REVISION_MINUTES / 60}h. Nothing
          else is ever scheduled on an exam day.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup">
          {[
            { value: true, label: "Yes, add revision" },
            { value: false, label: "No, keep exam days free" },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={allowRevision === opt.value}
              onClick={() => setAllowRevision(opt.value)}
              className={`text-sm font-semibold rounded-2xl px-3 py-2.5 border transition-colors ${
                allowRevision === opt.value
                  ? "bg-brand-50 dark:bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-200"
                  : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-brand-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-xs text-high-600">{error}</p>}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-300 rounded-2xl px-4 py-2"
          >
            Decide later
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!ready || saving}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-2xl px-4 py-2 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
