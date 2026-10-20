import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { daysRemaining, formatFriendlyDate } from "../../../utils/dateHelpers";

/**
 * Completion detail line - "completed X days before the deadline" / "...
 * after it became overdue" - computed from the real completedAt vs
 * deadlineDate, never fabricated: a task completed before completedAt was
 * ever tracked (e.g. marked "completed" via the journal's own mark-entry
 * flow, not our Complete button) has no completedAt at all, and honestly
 * falls back to an undated "Completed" rather than guessing.
 */
function completionDetail(task) {
  if (!task.completedAt) return "Completed";
  const diff = daysRemaining(task.deadlineDate, new Date(`${task.completedAt}T00:00:00`)); // deadline - completedAt, in days
  const dateLabel = formatFriendlyDate(task.completedAt);
  if (diff > 0) return `Completed ${dateLabel} · ${diff} day${diff === 1 ? "" : "s"} before the deadline`;
  if (diff === 0) return `Completed ${dateLabel} · on the deadline day`;
  const late = Math.abs(diff);
  return `Completed ${dateLabel} · ${late} day${late === 1 ? "" : "s"} after it became overdue`;
}

/**
 * Compact list of completed tasks - deliberately NOT the same card grid as
 * active tasks (see Tasks.jsx): once a task is done, its module/title/
 * priority already did their job of getting the student's attention, and
 * what's actually useful now is the on-time/late outcome, not another full
 * card competing for space with the tasks still open.
 */
export default function CompletedTaskList({ tasks }) {
  if (!tasks.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">
        Completed ({tasks.length})
      </p>
      <div className="card divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
        {tasks.map((task) => (
          <Link
            key={task.taskId}
            to={`/tasks/${task.taskId}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-low-500 flex items-center justify-center shrink-0">
              <Check size={13} className="text-white" strokeWidth={3} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-200 truncate">
                <span className="text-slate-400">{task.moduleName} · </span>
                {task.title}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{completionDetail(task)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
