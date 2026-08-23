import { motion } from "framer-motion";
import { GraduationCap, ListTodo, CalendarClock, Timer } from "lucide-react";
import { formatDeadlineCopy } from "../../../utils/dateHelpers";

function TrendPill({ value }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span className={`text-[11px] font-semibold ${up ? "text-low-600" : "text-high-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(2)}
    </span>
  );
}

function Card({ icon: Icon, iconBg, label, value, sub, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 22 }}
      className="card p-5 flex flex-col gap-3"
    >
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${iconBg}`}>
        <Icon size={19} className="text-white" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="font-display font-bold text-2xl text-slate-800 dark:text-white leading-tight mt-0.5">{value}</p>
      </div>
      {sub}
    </motion.div>
  );
}

export default function SummaryCards({ profile, assignments, weeklyHours, weeklyTarget = 15 }) {
  const pending = assignments.filter((a) => a.status === "pending");
  const highCount = pending.filter((a) => a.priorityLabel === "High" || a.assessmentType === "Exam").length;
  const nextDeadline = [...pending].sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate))[0];
  const progressPct = Math.min(100, Math.round((weeklyHours / weeklyTarget) * 100));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        icon={GraduationCap}
        iconBg="bg-gradient-to-br from-brand-500 to-brand-400"
        label="Current GPA"
        value={profile.currentGpa.toFixed(2)}
        sub={<TrendPill value={profile.currentGpa - profile.previousGpa} />}
        delay={0}
      />
      <Card
        icon={ListTodo}
        iconBg="bg-gradient-to-br from-accent-pink to-high-500"
        label="Pending Tasks"
        value={pending.length}
        sub={<span className="text-[11px] font-semibold text-high-600">{highCount} high priority</span>}
        delay={0.05}
      />
      <Card
        icon={CalendarClock}
        iconBg="bg-gradient-to-br from-medium-500 to-accent-orange"
        label="Next Deadline"
        value={nextDeadline ? formatDeadlineCopy(nextDeadline.deadlineDate) : "All clear"}
        sub={<span className="text-[11px] text-slate-400 truncate">{nextDeadline?.title || "No upcoming tasks"}</span>}
        delay={0.1}
      />
      <Card
        icon={Timer}
        iconBg="bg-gradient-to-br from-accent-teal to-low-500"
        label="Study Hours"
        value={`${weeklyHours}h`}
        sub={
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
            <div className="h-full bg-low-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        }
        delay={0.15}
      />
    </div>
  );
}
