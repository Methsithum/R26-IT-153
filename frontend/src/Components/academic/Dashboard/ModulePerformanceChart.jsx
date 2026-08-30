import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { moduleInitials } from "../../../utils/featureNameMap";

const BAR_COLORS = ["#7c3aed", "#14b8a6", "#ec4899", "#fb923c", "#3b82f6"];

export default function ModulePerformanceChart({ modules }) {
  const data = modules.map((m) => ({ name: moduleInitials(m.name), grade: m.currentGrade, fullName: m.name }));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-display font-bold text-slate-800 dark:text-white">Module Performance</p>
          <p className="text-xs text-slate-400">Current grade by module</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barSize={34}>
          <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-white/10" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} domain={[0, 100]} />
          <Tooltip
            cursor={{ fill: "rgba(124,58,237,0.06)" }}
            contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 10px 30px -10px rgba(124,58,237,0.25)" }}
            formatter={(value, _name, item) => [`${value}%`, item.payload.fullName]}
          />
          <Bar dataKey="grade" radius={[10, 10, 10, 10]}>
            {data.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
