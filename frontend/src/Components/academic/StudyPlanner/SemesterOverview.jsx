import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAcademicStore } from "../../../store/useAcademicStore";
import EmptyState from "../Shared/EmptyState";
import { CalendarRange } from "lucide-react";

const COLOR_HEX = { brand: "#7c3aed", teal: "#14b8a6", pink: "#ec4899", orange: "#fb923c" };

// Real data: each week's per-module split comes from
// utils/studyAllocation.js, computed from the module's actual remaining
// task deadlines and exam dates (both real, synced from the journal) and
// the student's real weekly availability (Profile > Available Study
// Hours/Week) — recomputed by the store whenever any of those change.
export default function SemesterOverview() {
  const modules = useAcademicStore((s) => s.modules);
  const data = useAcademicStore((s) => s.semesterAllocation);

  if (!modules.length || !data.length) {
    return (
      <div className="card p-5">
        <EmptyState
          icon={CalendarRange}
          title="No semester projection yet"
          subtitle="Add modules and deadlines in your journal to see a weekly study-hours breakdown here."
        />
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-4">
        <p className="font-display font-bold text-slate-800 dark:text-white">Semester Study Load</p>
        <p className="text-xs text-slate-400">
          Projected weekly hours per module, based on your real deadlines/exams and weekly availability
        </p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="4 8" vertical={false} className="text-slate-100 dark:text-white/10" stroke="currentColor" />
          <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <Tooltip contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 10px 30px -10px rgba(124,58,237,0.25)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {modules.map((m) => (
            <Bar key={m.code} dataKey={m.code} name={m.name} stackId="hours" fill={COLOR_HEX[m.color] || "#7c3aed"} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
