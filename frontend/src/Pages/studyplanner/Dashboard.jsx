import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import Topbar from "../../Components/academic/Layout/Topbar";
import SummaryCards from "../../Components/academic/Dashboard/SummaryCards";
import ModulePerformanceChart from "../../Components/academic/Dashboard/ModulePerformanceChart";
import AIRecommendationCard from "../../Components/academic/Dashboard/AIRecommendationCard";
import TodayTimeline from "../../Components/academic/Dashboard/TodayTimeline";
import { SkeletonCard } from "../../Components/academic/Shared/Skeletons";
import { useAcademicStore } from "../../store/useAcademicStore";
import { useWeeklySchedule } from "../../hooks/useAcademicData";
import { greetingForNow } from "../../utils/dateHelpers";
import { MOCK_WEEKLY_STUDY_HOURS } from "../../mocks/academicMocks";

export default function Dashboard() {
  const profile = useAcademicStore((s) => s.profile);
  const modules = useAcademicStore((s) => s.modules);
  const assignments = useAcademicStore((s) => s.assignments);
  const { schedule, loading, error } = useWeeklySchedule();

  const weeklyHours = useMemo(() => MOCK_WEEKLY_STUDY_HOURS.reduce((sum, d) => sum + d.hours, 0), []);

  const enrichedAssignments = useMemo(() => {
    if (!schedule?.tasks) return assignments;
    return assignments.map((a) => ({ ...a, priorityLabel: schedule.tasks[a.taskId]?.priority_label }));
  }, [assignments, schedule]);

  const atRiskModule = [...modules].sort((a, b) => a.currentGrade - b.currentGrade)[0];

  return (
    <div>
      <Topbar title={`${greetingForNow()}, ${profile.name.split(" ")[0]}`} subtitle="Here's your academic overview for today." />

      <div className="px-4 sm:px-6 pb-10 space-y-6">
        <SummaryCards profile={profile} assignments={enrichedAssignments} weeklyHours={weeklyHours} />

        <AIRecommendationCard modules={modules} assignments={assignments} />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <ModulePerformanceChart modules={modules} />
          </div>
          <div className="lg:col-span-2">
            {loading ? <SkeletonCard className="h-full min-h-[260px]" /> : <TodayTimeline schedule={schedule?.schedule} tasksRegistry={schedule?.tasks} />}
          </div>
        </div>

        {error && (
          <div className="card p-4 flex items-center gap-2 text-sm text-high-600 bg-high-50 dark:bg-high-500/10">
            <AlertTriangle size={16} />
            Couldn't reach the study planner backend ({error}). Is the FastAPI server running on port 8000?
          </div>
        )}

        {atRiskModule && atRiskModule.currentGrade < 65 && (
          <div className="card p-5 border-l-4 border-medium-500">
            <p className="text-xs font-semibold text-medium-600 uppercase tracking-wide mb-1">Academic Attention Recommended</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {atRiskModule.name}: currently {atRiskModule.currentGrade}%, next deadline coming up soon. A little
              extra focus here could make a real difference — nothing to worry about, just a friendly nudge.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
