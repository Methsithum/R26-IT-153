import { motion } from "framer-motion";
import { GraduationCap } from "lucide-react";
import Topbar from "../../Components/academic/Layout/Topbar";
import EmptyState from "../../Components/academic/Shared/EmptyState";
import { useAcademicStore } from "../../store/useAcademicStore";
import { daysRemaining, formatFriendlyDate } from "../../utils/dateHelpers";

export default function Exams() {
  const modules = useAcademicStore((s) => s.modules);
  const exams = [...useAcademicStore((s) => s.exams)].sort((a, b) => a.date.localeCompare(b.date));

  if (exams.length === 0) {
    return (
      <div>
        <Topbar title="Exams" subtitle="Upcoming exams across your modules." />
        <div className="px-4 sm:px-6 pb-10">
          <EmptyState
            icon={GraduationCap}
            title="No exam dates yet"
            subtitle="Exam dates recorded in your journal will show up here once set."
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Exams" subtitle="Upcoming exams across your modules." />
      <div className="px-4 sm:px-6 pb-10 space-y-3">
        {exams.map((exam, i) => {
          const days = daysRemaining(exam.date);
          const module = modules.find((m) => m.code === exam.module);
          return (
            <motion.div
              key={exam.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="card p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-orange to-medium-500 flex items-center justify-center text-white shrink-0">
                <GraduationCap size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-700 dark:text-white truncate">{exam.type} — {exam.moduleName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatFriendlyDate(exam.date)} {module ? `· Current grade ${module.currentGrade}%` : ""}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-display font-bold text-lg ${days <= 7 ? "text-high-600" : "text-slate-700 dark:text-white"}`}>{days}</p>
                <p className="text-[11px] text-slate-400">days left</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
