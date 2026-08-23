import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Topbar from "../../Components/academic/Layout/Topbar";
import { useAcademicStore } from "../../store/useAcademicStore";
import { MOCK_MODULE_PERFORMANCE_TREND } from "../../mocks/academicMocks";
import { predictCluster } from "../../services/academicApi";
import { formatDeadlineCopy } from "../../utils/dateHelpers";

export default function ModuleDetail() {
  const { code } = useParams();
  const navigate = useNavigate();
  const module = useAcademicStore((s) => s.modules.find((m) => m.code === code));
  const allAssignments = useAcademicStore((s) => s.assignments);
  const assignments = useMemo(() => allAssignments.filter((a) => a.module === code), [allAssignments, code]);

  const [cluster, setCluster] = useState(null);
  const [clusterLoading, setClusterLoading] = useState(true);

  const referenceTask = assignments[0];

  useEffect(() => {
    if (!referenceTask) return setClusterLoading(false);
    const fr = referenceTask.featureRow;
    setClusterLoading(true);
    predictCluster({
      avg_weekly_clicks: fr.avg_weekly_clicks,
      clicks_trend: fr.clicks_trend,
      active_weeks_ratio: fr.active_weeks_ratio,
      has_vle_activity: fr.has_vle_activity,
      prior_avg_score: fr.prior_avg_score,
      num_of_prev_attempts: fr.num_of_prev_attempts,
      studied_credits: fr.studied_credits,
    })
      .then(setCluster)
      .catch(() => {})
      .finally(() => setClusterLoading(false));
  }, [referenceTask]);

  const trendData = useMemo(
    () => MOCK_MODULE_PERFORMANCE_TREND.map((row) => ({ term: row.term, grade: row[code] })),
    [code]
  );

  if (!module) {
    return <div className="p-6 text-slate-500">Module not found.</div>;
  }

  return (
    <div>
      <Topbar title={module.name} subtitle="Module details" />
      <div className="px-4 sm:px-6 pb-10 space-y-5">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-brand-600">
          <ArrowLeft size={15} /> Back
        </button>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniStat label="Current Grade" value={`${module.currentGrade}%`} />
          <MiniStat label="Assignments" value={module.taskCount} />
          <MiniStat label="Next Deadline" value={formatDeadlineCopy(module.nextDeadline)} />
          <MiniStat label="Study Hours (wk)" value={`${module.studyHoursThisWeek}h`} />
        </div>

        <div className="card p-5">
          <p className="font-display font-bold text-slate-800 dark:text-white mb-4">Performance Trend</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="4 8" vertical={false} className="text-slate-100 dark:text-white/10" stroke="currentColor" />
              <XAxis dataKey="term" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 10px 30px -10px rgba(124,58,237,0.25)" }} />
              <Line type="monotone" dataKey="grade" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4, fill: "#7c3aed" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center">
              <Users size={16} className="text-brand-500" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-white">Your Study Behavior Pattern</p>
          </div>
          {clusterLoading ? (
            <div className="h-4 w-2/3 bg-slate-100 dark:bg-white/10 rounded animate-pulse" />
          ) : cluster ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Based on your engagement in this module, you're most similar to students in the{" "}
              <span className="font-semibold text-brand-600">"{cluster.cluster_label}"</span> group. This is just a
              light behavioral grouping to help tailor suggestions — not a judgment of ability.
            </p>
          ) : (
            <p className="text-sm text-slate-400">No behavioral data available for this module yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="font-display font-bold text-lg text-slate-800 dark:text-white mt-0.5">{value}</p>
    </div>
  );
}
