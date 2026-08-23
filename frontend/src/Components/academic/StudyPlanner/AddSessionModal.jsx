import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Plus } from "lucide-react";
import { useAcademicStore } from "../../../store/useAcademicStore";
import { WEEKDAYS } from "../../../utils/dateHelpers";
import PriorityBadge from "../Shared/PriorityBadge";

export default function AddSessionModal({ open, onClose }) {
  const modules = useAcademicStore((s) => s.modules);
  const assignments = useAcademicStore((s) => s.assignments);
  const scheduleResponse = useAcademicStore((s) => s.scheduleResponse);
  const setSchedule = useAcademicStore((s) => s.setSchedule);

  const [moduleCode, setModuleCode] = useState(modules[0]?.code || "");
  const [taskId, setTaskId] = useState("");
  const [day, setDay] = useState(WEEKDAYS[0]);
  const [startTime, setStartTime] = useState("18:00");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");

  const tasksForModule = useMemo(
    () => assignments.filter((a) => a.module === moduleCode && a.status === "pending"),
    [assignments, moduleCode]
  );
  const selectedTask = tasksForModule.find((t) => t.taskId === taskId) || tasksForModule[0];
  const priority = selectedTask ? scheduleResponse?.tasks?.[selectedTask.taskId]?.priority_label : null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!selectedTask) return onClose();

    const [h, m] = startTime.split(":").map(Number);
    const endMinutes = h * 60 + m + Number(duration);
    const endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

    const newItem = {
      time_slot: `${startTime}-${endTime}`,
      task_id: selectedTask.taskId,
      module: moduleCode,
      duration_minutes: Number(duration),
      notes,
    };

    const base = scheduleResponse || { schedule: {}, overload_warning: [], tasks: {} };
    const daySessions = base.schedule[day] || [];
    setSchedule({
      ...base,
      schedule: { ...base.schedule, [day]: [...daySessions, newItem] },
    });
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="w-full sm:max-w-md bg-white dark:bg-[#1a1530] rounded-t-3xl sm:rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-thin"
          >
            <div className="flex items-center justify-between">
              <p className="font-display font-bold text-lg text-slate-800 dark:text-white">Add Study Session</p>
              <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Module</label>
              <select
                value={moduleCode}
                onChange={(e) => {
                  setModuleCode(e.target.value);
                  setTaskId("");
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
              >
                {modules.map((m) => (
                  <option key={m.code} value={m.code}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Task</label>
              <select
                value={selectedTask?.taskId || ""}
                onChange={(e) => setTaskId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
              >
                {tasksForModule.length === 0 && <option value="">No pending tasks for this module</option>}
                {tasksForModule.map((t) => (
                  <option key={t.taskId} value={t.taskId}>{t.title}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Day</label>
                <select value={day} onChange={(e) => setDay(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm">
                  {WEEKDAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Start Time</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Duration (minutes)</label>
              <input
                type="number"
                min={15}
                step={15}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 mb-1">Priority (auto-generated)</p>
              {priority ? <PriorityBadge priority={priority} /> : <p className="text-xs text-slate-400">Predicted once the plan is generated.</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm resize-none"
                placeholder="Optional notes for this session"
              />
            </div>

            <button
              type="submit"
              disabled={!selectedTask}
              className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white font-semibold rounded-2xl py-3 transition-colors"
            >
              <Plus size={17} /> Add Session
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
