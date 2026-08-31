import { BookOpen, ListChecks, GraduationCap, Flame } from "lucide-react";
import { daysRemaining } from "../../../utils/dateHelpers";

/** Small real-number snapshot - a quiet "here's where things actually stand" while you're in Settings, not a duplicate of Dashboard's own cards (no grade/priority breakdowns here, just plain counts). */
export default function QuickFacts({ modules, assignments, exams, streak }) {
  const pendingCount = assignments.filter((a) => a.status === "pending").length;
  const upcomingExamCount = exams.filter((e) => daysRemaining(e.date) >= 0).length;

  const facts = [
    { icon: BookOpen, label: "Modules", value: modules.length },
    { icon: ListChecks, label: "Pending tasks", value: pendingCount },
    { icon: GraduationCap, label: "Upcoming exams", value: upcomingExamCount },
    { icon: Flame, label: "Day streak", value: streak },
  ];

  return (
    <div className="card p-5">
      <p className="font-display font-bold text-slate-800 dark:text-white mb-4">Quick Facts</p>
      <div className="grid grid-cols-2 gap-3">
        {facts.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl bg-slate-50 dark:bg-white/5 p-3">
            <Icon size={15} className="text-slate-400 mb-1.5" />
            <p className="font-display font-bold text-lg text-slate-800 dark:text-white leading-none">{value}</p>
            <p className="text-[11px] text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
