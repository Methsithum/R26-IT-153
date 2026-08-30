import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#7c3aed", "#14b8a6", "#ec4899", "#fb923c"];

export default function TimeAllocationChart({ modules }) {
  const totalHours = modules.reduce((sum, m) => sum + m.studyHoursThisWeek, 0) || 1;
  const data = modules.map((m) => ({ name: m.name, value: m.studyHoursThisWeek, pct: Math.round((m.studyHoursThisWeek / totalHours) * 100) }));

  return (
    <div className="card p-5">
      <p className="font-display font-bold text-slate-800 dark:text-white mb-2">Time Allocation by Module</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 10px 30px -10px rgba(124,58,237,0.25)" }}
            formatter={(v, n, item) => [`${item.payload.pct}%`, n]}
          />
          <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
