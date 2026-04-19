import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const PIE_COLORS = ['#f59e0b', '#d97706', '#92400e']

export function ActivityChart({ weeklyStudyHours, activityBreakdown }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="mb-3 font-cinzel text-lg text-amber-200">Weekly Study Hours</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={weeklyStudyHours}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: '#020617', border: '1px solid #f59e0b' }} />
              <Bar dataKey="hours" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="mb-3 font-cinzel text-lg text-amber-200">Activity Breakdown</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={activityBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} label>
                {activityBreakdown.map((entry, index) => (
                  <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#020617', border: '1px solid #f59e0b' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
