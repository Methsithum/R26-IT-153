import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Check, AlertTriangle, Clock } from "lucide-react";
import PriorityBadge from "../Shared/PriorityBadge";
import { formatDeadlineCopy } from "../../../utils/dateHelpers";

export default function TaskCard({ task, priority, onComplete, index = 0 }) {
  const progress = task.estimatedHoursNeeded > 0 ? Math.min(1, task.completedHours / task.estimatedHoursNeeded) : 0;
  const isMissed = task.status === "missed";
  const isCompleted = task.status === "completed";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.25 } }}
      transition={{ delay: index * 0.04 }}
      className={`card p-4 relative overflow-hidden ${isMissed ? "border-l-4 border-high-500" : isCompleted ? "opacity-70" : ""}`}
    >
      {isMissed && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-high-600 mb-2">
          <AlertTriangle size={13} /> Missed Study Session
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <Link to={`/tasks/${task.taskId}`} className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wide">{task.moduleName}</p>
          <p className="font-semibold text-slate-700 dark:text-white mt-0.5 truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
            <Clock size={12} /> {formatDeadlineCopy(task.deadlineDate)}
          </div>
        </Link>
        {priority && <PriorityBadge priority={priority} />}
      </div>

      {!isCompleted && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>{task.completedHours}h / {task.estimatedHoursNeeded}h</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-400 to-accent-teal rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        {!isCompleted && (
          <button
            onClick={() => onComplete(task.taskId)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-low-50 dark:bg-low-500/15 text-low-600 hover:bg-low-100 dark:hover:bg-low-500/25 rounded-full px-3 py-1.5 transition-colors"
          >
            <Check size={13} /> Complete
          </button>
        )}
        <Link
          to={`/tasks/${task.taskId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-brand-600 bg-slate-50 dark:bg-white/5 rounded-full px-3 py-1.5 transition-colors"
        >
          {isCompleted ? "View" : "Continue"}
        </Link>
      </div>

      {isCompleted && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-low-500 flex items-center justify-center">
          <Check size={13} className="text-white" strokeWidth={3} />
        </div>
      )}
    </motion.div>
  );
}
