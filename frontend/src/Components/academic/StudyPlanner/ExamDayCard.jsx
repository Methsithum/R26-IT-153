import { GraduationCap, AlertTriangle, BookOpen, Settings2 } from "lucide-react";
import { formatFriendlyDate, toLocalDateStr } from "../../../utils/dateHelpers";
import { examLabel } from "../../../utils/examDay";
import { sessionKey, toSessionInput } from "../../../utils/sessionTracking";
import { useAcademicStore } from "../../../store/useAcademicStore";
import SessionStatusControls from "./SessionStatusControls";

/**
 * Shown INSTEAD of a timeline on an exam day - nothing is scheduled then,
 * except (back-to-back exams only, and only if the student agreed) one
 * short revision session after the exam for the NEXT day's exam. Only
 * High-priority assignments due right around the exam get a mention, as a
 * heads-up rather than a session.
 */
export default function ExamDayCard({
  exams,
  dateStr,
  highPriorityTasks = [],
  moduleName,
  revision = null,
  // false when the caller renders the revision as its own timeline card
  // (Week / Today views); the Dashboard keeps it inline.
  inlineRevision = true,
  cluster = null,
  isPast = false,
  compact = false,
}) {
  const sessionRecords = useAcademicStore((s) => s.sessionRecords);
  const openExamPlan = useAcademicStore((s) => s.openExamPlan);
  const text = compact ? "text-[10px]" : "text-xs";

  const revisionRecord = revision && sessionRecords[sessionKey(dateStr, revision.item.task_id, revision.item.time_slot)];
  const canMarkRevision = revision && dateStr <= toLocalDateStr(new Date());

  return (
    <div className={`rounded-xl border-2 border-blue-500/70 bg-blue-50 dark:bg-blue-500/10 ${compact ? "p-2.5" : "p-4"}`}>
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-300">
          <GraduationCap size={compact ? 13 : 16} />
          <p className={`font-bold uppercase tracking-wide ${text}`}>Exam day</p>
        </div>
        {cluster && !isPast && (
          <button
            type="button"
            onClick={() => openExamPlan(cluster)}
            title="Change exam times / revision"
            aria-label="Change exam times or revision"
            className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-200"
          >
            <Settings2 size={compact ? 12 : 14} />
          </button>
        )}
      </div>
      <ul className="mt-1 space-y-0.5">
        {exams.map((exam) => (
          <li key={exam.id} className={`font-semibold text-slate-700 dark:text-white leading-snug ${compact ? "text-xs" : "text-sm"}`}>
            {examLabel(exam, moduleName)}
          </li>
        ))}
      </ul>
      {!isPast && (
        <p className={`text-slate-500 dark:text-slate-300 mt-1.5 leading-snug ${text}`}>
          {revision
            ? "Good luck! 🍀 After your exam, take a break - then one short revision for tomorrow's exam."
            : "Good luck! 🍀 Nothing else is planned today - you've prepared for this, go show what you know."}
        </p>
      )}

      {revision && !inlineRevision && (
        <p className={`text-blue-700 dark:text-blue-200 font-semibold mt-1 ${text}`}>
          After the exam: revision at {revision.item.time_slot} (below)
        </p>
      )}

      {revision && inlineRevision && (
        <div className={`mt-2 rounded-lg bg-white/70 dark:bg-white/5 ${compact ? "p-1.5" : "p-2.5"}`}>
          <p className={`flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-200 ${text}`}>
            <BookOpen size={compact ? 10 : 12} /> {revision.item.time_slot} · Revision
          </p>
          <p className={`text-slate-600 dark:text-slate-300 leading-snug ${text}`}>
            {revision.nextExam.moduleName || moduleName(revision.nextExam.module)} - exam tomorrow · {revision.item.duration_minutes} min
          </p>
          {canMarkRevision && (
            <SessionStatusControls
              compact={compact}
              sessionInput={toSessionInput(dateStr, revision.item, { [revision.item.task_id]: revision.registryEntry })}
              record={revisionRecord}
            />
          )}
        </div>
      )}

      {highPriorityTasks.length > 0 && (
        <div className={`mt-2 rounded-lg bg-white/70 dark:bg-white/5 ${compact ? "p-1.5" : "p-2.5"}`}>
          <p className={`flex items-center gap-1 font-semibold text-high-600 ${text}`}>
            <AlertTriangle size={compact ? 10 : 12} /> High priority, due soon
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {highPriorityTasks.map((t) => (
              <li key={t.taskId} className={`text-slate-600 dark:text-slate-300 leading-snug ${text}`}>
                {t.title} · {formatFriendlyDate(t.deadlineDate)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
