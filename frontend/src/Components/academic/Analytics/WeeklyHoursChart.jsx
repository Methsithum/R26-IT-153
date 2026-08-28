import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function WeeklyHoursChart({ data }) {
  return (
    <div className="card p-5">
      <p className="font-display font-bold text-slate-800 dark:text-white mb-4">Weekly Study Hours</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barSize={28}>
          <CartesianGrid strokeDasharray="4 8" vertical={false} className="text-slate-100 dark:text-white/10" stroke="currentColor" />
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
          <Tooltip
            cursor={{ fill: "rgba(124,58,237,0.06)" }}
            contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 10px 30px -10px rgba(124,58,237,0.25)" }}
            formatter={(v) => [`${v}h`, "Studied"]}
          />
          <Bar dataKey="hours" radius={[10, 10, 10, 10]} fill="#7c3aed" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
