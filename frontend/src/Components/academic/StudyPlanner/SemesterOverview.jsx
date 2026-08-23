import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { MOCK_MODULES } from "../../../mocks/academicMocks";

const COLORS = { AAA: "#7c3aed", BBB: "#14b8a6", CCC: "#ec4899", DDD: "#fb923c" };

// MOCK — semester-level scheduling has no backend endpoint yet (Section 14 #1).
function buildSemesterData() {
  const weeks = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);
  return weeks.map((w, i) => {
    const row = { week: w };
    MOCK_MODULES.forEach((m, mi) => {
      row[m.code] = Math.max(0, Math.round((3 + Math.sin(i / 2 + mi) * 2) * 10) / 10);
    });
    return row;
  });
}

export default function SemesterOverview() {
  const data = useMemo(buildSemesterData, []);

  return (
    <div className="card p-5">
      <div className="mb-4">
        <p className="font-display font-bold text-slate-800 dark:text-white">Semester Study Load</p>
        <p className="text-xs text-slate-400">Projected weekly hours per module across the term (illustrative)</p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="4 8" vertical={false} className="text-slate-100 dark:text-white/10" stroke="currentColor" />
          <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <Tooltip contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 10px 30px -10px rgba(124,58,237,0.25)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {MOCK_MODULES.map((m) => (
            <Bar key={m.code} dataKey={m.code} stackId="hours" fill={COLORS[m.code]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
