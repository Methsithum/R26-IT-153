import { useState } from "react";
import { RefreshCw, Plus } from "lucide-react";
import { motion } from "framer-motion";
import Topbar from "../../Components/academic/Layout/Topbar";
import ViewToggle from "../../Components/academic/StudyPlanner/ViewToggle";
import DayView from "../../Components/academic/StudyPlanner/DayView";
import WeekGrid from "../../Components/academic/StudyPlanner/WeekGrid";
import MonthGrid from "../../Components/academic/StudyPlanner/MonthGrid";
import SemesterOverview from "../../Components/academic/StudyPlanner/SemesterOverview";
import AddSessionModal from "../../Components/academic/StudyPlanner/AddSessionModal";
import { SkeletonCard } from "../../Components/academic/Shared/Skeletons";
import { useWeeklySchedule } from "../../hooks/useAcademicData";

export default function StudyPlanner() {
  const [view, setView] = useState("Week");
  const [modalOpen, setModalOpen] = useState(false);
  const { schedule, loading, error, regenerate } = useWeeklySchedule();

  return (
    <div>
      <Topbar title="Study Planner" subtitle="Your personalized, ML-generated study schedule." />

      <div className="px-4 sm:px-6 pb-10 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ViewToggle value={view} onChange={setView} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => regenerate()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 bg-brand-50 dark:bg-brand-500/15 hover:bg-brand-100 dark:hover:bg-brand-500/25 rounded-full px-4 py-2 transition-colors disabled:opacity-50"
            >
              <motion.span animate={loading ? { rotate: 360 } : {}} transition={loading ? { repeat: Infinity, duration: 0.8, ease: "linear" } : {}}>
                <RefreshCw size={15} />
              </motion.span>
              Regenerate Plan
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-full px-4 py-2 transition-colors"
            >
              <Plus size={15} /> Add Session
            </button>
          </div>
        </div>

        {error && (
          <div className="card p-4 text-sm text-high-600 bg-high-50 dark:bg-high-500/10">
            Couldn't load your schedule from the backend ({error}).
          </div>
        )}

        {loading ? (
          <SkeletonCard className="h-72" />
        ) : (
          <>
            {view === "Today" && <DayView schedule={schedule?.schedule} tasksRegistry={schedule?.tasks} />}
            {view === "Week" && <WeekGrid schedule={schedule?.schedule} tasksRegistry={schedule?.tasks} overloadWarning={schedule?.overload_warning} />}
            {view === "Month" && <MonthGrid />}
            {view === "Semester" && <SemesterOverview />}
          </>
        )}
      </div>

      <AddSessionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
