import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useAcademicStore } from "../../../store/useAcademicStore";

/** Shown until the student fills in Semester setup - until then four priority-model features use neutral defaults. */
export default function SemesterSetupPrompt() {
  const userId = useAcademicStore((s) => s.userId);
  const semesterSetup = useAcademicStore((s) => s.semesterSetup);
  if (!userId || semesterSetup) return null;

  return (
    <div className="card p-4 border-l-4 border-brand-400 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-white">Make your priorities more accurate</p>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
          Add your semester dates, subject credits and any repeat subjects - takes a minute, asked once.
        </p>
      </div>
      <Link
        to="/settings#semester-setup"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 bg-brand-50 dark:bg-brand-500/15 hover:bg-brand-100 rounded-full px-4 py-2"
      >
        <GraduationCap size={14} /> Semester setup
      </Link>
    </div>
  );
}
