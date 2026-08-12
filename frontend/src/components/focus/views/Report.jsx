import React from "react";
import Card from "../Card";

// All figures here come from the live session (props from FocusApp) — there's
// no persistence, so this is a "today so far" report, not a multi-day one.
export default function TabReport({ focusMin, points, dist, myRank, todayGoal }) {
  const distTotal = Object.values(dist).reduce((a, b) => a + b, 0);
  const trackedTotal = focusMin + distTotal;
  const focusScore = trackedTotal > 0 ? Math.round((focusMin / trackedTotal) * 100) : 0;
  const goalPct = Math.round(Math.min((focusMin / todayGoal) * 100, 100));

  const dailySummary = [
    { label: "Focus", value: focusMin, unit: "min", color: "#22c55e", pct: trackedTotal > 0 ? Math.round((focusMin / trackedTotal) * 100) : 0 },
    { label: "Fatigue", value: dist.Fatigue || 0, unit: "min", color: "#f97316", pct: distTotal > 0 ? Math.round(((dist.Fatigue || 0) / distTotal) * 100) : 0 },
    { label: "Anxiety", value: dist.Anxiety || 0, unit: "min", color: "#ef4444", pct: distTotal > 0 ? Math.round(((dist.Anxiety || 0) / distTotal) * 100) : 0 },
    { label: "Boredom", value: dist.Boredom || 0, unit: "min", color: "#3b82f6", pct: distTotal > 0 ? Math.round(((dist.Boredom || 0) / distTotal) * 100) : 0 },
  ];

  const dominantDistraction = distTotal > 0
    ? Object.entries(dist).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const notes = [
    trackedTotal === 0
      ? { icon: "📷", text: "No detections yet this session — start Live Monitoring to build your report.", color: "#64748b" }
      : null,
    dominantDistraction
      ? { icon: "🎯", text: `${dominantDistraction} has been your most common distraction so far this session (${dist[dominantDistraction]}m).`, color: "#f97316" }
      : null,
    focusMin >= todayGoal
      ? { icon: "🎉", text: `You've hit today's ${todayGoal}-minute focus goal!`, color: "#22c55e" }
      : trackedTotal > 0
        ? { icon: "⏱", text: `${Math.max(todayGoal - Math.round(focusMin), 0)} more focused minutes to reach today's goal.`, color: "#3b82f6" }
        : null,
  ].filter(Boolean);

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Focus Time", value: `${Math.round(focusMin)}m`, icon: "⏱", color: "#22c55e" },
            { label: "Distraction Time", value: `${Math.round(distTotal)}m`, icon: "😴", color: "#f97316" },
            { label: "Focus Score", value: `${focusScore}%`, icon: "🎯", color: "#a855f7" },
            { label: "Goal Progress", value: `${goalPct}%`, icon: "📊", color: "#3b82f6" },
          ].map(s => (
            <Card key={s.label} className="p-4 text-center">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-slate-600">{s.label}</p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-slate-900">Session Summary</h3>
                <p className="text-xs text-slate-600">Focus and distraction split so far today</p>
              </div>
              <div className="text-xs px-2.5 py-1 rounded-full border border-slate-300 text-slate-600">{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
            </div>
            <div className="space-y-3">
              {dailySummary.map(item => (
                <div key={item.label} className="rounded-xl border border-white/5 p-3" style={{ backgroundColor: `${item.color}08`, borderColor: `${item.color}20` }}>
                  <div className="flex justify-between text-sm mb-2">
                    <span style={{ color: item.color }}>{item.label}</span>
                    <span className="font-bold" style={{ color: item.color }}>{item.value}{item.unit}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-300 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(item.pct, 100)}%`, backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}55` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 mb-2">Daily Goal</h3>
            <p className="text-xs text-slate-600 mb-4">{Math.round(focusMin)} / {todayGoal} focused minutes</p>
            <div className="h-3 rounded-full bg-slate-200 overflow-hidden mb-2">
              <div className="h-full rounded-full relative transition-all duration-700" style={{ width: `${goalPct}%`, background: "linear-gradient(90deg,#22c55e,#86efac)", boxShadow: "0 0 10px #22c55e40" }}>
                <div className="absolute inset-0 bg-white/10 animate-pulse" />
              </div>
            </div>
            <p className="text-2xl font-bold text-green-500">{goalPct}%</p>
            {focusMin >= todayGoal && <p className="text-xs text-green-500 mt-1">🎉 Goal achieved! +100 bonus pts</p>}
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Daily Report</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: "Focus Time", value: `${Math.round(focusMin)} min`, color: "#22c55e" },
                { label: "Total Points", value: `${points} pts`, color: "#f59e0b" },
                { label: "Fatigue Events", value: `${dist.Fatigue || 0} min`, color: "#f97316" },
                { label: "Anxiety Events", value: `${dist.Anxiety || 0} min`, color: "#ef4444" },
                { label: "Boredom Events", value: `${dist.Boredom || 0} min`, color: "#3b82f6" },
                { label: "Team Rank", value: `#${myRank}`, color: "#a855f7" },
              ].map(r => (
                <div key={r.label} className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-slate-600">{r.label}</span>
                  <span className="font-bold" style={{ color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-slate-900 mb-4">💡 Session Notes</h3>
            <div className="space-y-3">
              {notes.map((ins, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl border" style={{ borderColor: `${ins.color}25`, backgroundColor: `${ins.color}08` }}>
                  <span className="text-xl shrink-0">{ins.icon}</span>
                  <p className="text-xs text-slate-700 leading-relaxed">{ins.text}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
