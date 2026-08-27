import Topbar from "../../Components/academic/Layout/Topbar";
import WeeklyHoursChart from "../../Components/academic/Analytics/WeeklyHoursChart";
import TimeAllocationChart from "../../Components/academic/Analytics/TimeAllocationChart";
import ProductivityAndStreak from "../../Components/academic/Analytics/ProductivityAndStreak";
import AcademicRiskSection from "../../Components/academic/Analytics/AcademicRiskSection";
import { useAcademicStore } from "../../store/useAcademicStore";
import { MOCK_WEEKLY_STUDY_HOURS, MOCK_PRODUCTIVITY_SCORE } from "../../mocks/academicMocks";

export default function Analytics() {
  const modules = useAcademicStore((s) => s.modules);
  const streak = useAcademicStore((s) => s.streak);

  return (
    <div>
      <Topbar title="Study Analytics" subtitle="How your study habits are trending." />
      <div className="px-4 sm:px-6 pb-10 space-y-5">
        <ProductivityAndStreak productivity={MOCK_PRODUCTIVITY_SCORE} streak={{ days: streak, best: 14 }} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <WeeklyHoursChart data={MOCK_WEEKLY_STUDY_HOURS} />
          <TimeAllocationChart modules={modules} />
        </div>

        <AcademicRiskSection modules={modules} />
      </div>
    </div>
  );
}
