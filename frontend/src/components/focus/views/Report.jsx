import React from "react";
import Card from "../Card";
import { PageHeader, SectionTitle, StatTile, Meter, Badge, DataRow, ProgressRing, EmptyState } from "../ui";

const DISTRACTIONS = [
  { key: "Fatigue", icon: "😴", color: "#f97316" },
  { key: "Anxiety", icon: "😰", color: "#ef4444" },
  { key: "Boredom", icon: "😑", color: "#3b82f6" },
];

// All figures here come from the live session (props from FocusApp) — there's
// no persistence, so this is a "today so far" report, not a multi-day one.
export default function TabReport({ focusMin, points, dist, myRank, todayGoal }) {
  const distTotal = Object.values(dist).reduce((a, b) => a + b, 0);
  const trackedTotal = focusMin + distTotal;
  const hasData = trackedTotal > 0;
  const focusScore = hasData ? Math.round((focusMin / trackedTotal) * 100) : 0;
  const goalPct = Math.round(Math.min((focusMin / todayGoal) * 100, 100));

  const dailySummary = [
    { label: "Focus", icon: "🎯", value: focusMin, color: "#22c55e", pct: hasData ? (focusMin / trackedTotal) * 100 : 0 },
    ...DISTRACTIONS.map((d) => ({
      label: d.key,
      icon: d.icon,
      value: dist[d.key] || 0,
      color: d.color,
      pct: hasData ? ((dist[d.key] || 0) / trackedTotal) * 100 : 0,
    })),
  ];

  const rankedDistractions = DISTRACTIONS
    .map((d) => ({ ...d, value: dist[d.key] || 0 }))
    .sort((a, b) => b.value - a.value);

  const dominantDistraction = distTotal > 0 ? rankedDistractions[0] : null;

  // The focus score only means something once there's enough tracked time behind
  // it; below that it reads as a verdict on a couple of frames.
  const scoreVerdict = !hasData
    ? { text: "Awaiting data", color: "#64748b" }
    : focusScore >= 80
      ? { text: "Excellent focus", color: "#22c55e" }
      : focusScore >= 60
        ? { text: "Solid session", color: "#f59e0b" }
        : { text: "Room to improve", color: "#f97316" };

  const notes = [
    !hasData
      ? { icon: "📷", text: "No detections yet this session — start Live Monitoring to build your report.", color: "#64748b" }
      : null,
    dominantDistraction
      ? { icon: "🎯", text: `${dominantDistraction.key} has been your most common distraction so far this session (${dominantDistraction.value}m).`, color: "#f97316" }
      : null,
    focusMin >= todayGoal
      ? { icon: "🎉", text: `You've hit today's ${todayGoal}-minute focus goal!`, color: "#22c55e" }
      : hasData
        ? { icon: "⏱", text: `${Math.max(todayGoal - Math.round(focusMin), 0)} more focused minutes to reach today's goal.`, color: "#3b82f6" }
        : null,
  ].filter(Boolean);

  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="fu-view">
      <PageHeader
        icon="📈"
        title="Session Report"
        subtitle="Live figures from this session — nothing is carried over between days"
        right={
          <>
            <Badge color="#64748b">📅 {today}</Badge>
            <button
              onClick={() => window.print()}
              className="fu-no-print px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 transition-all"
            >
              🖨 Print
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Focus Time", value: Math.round(focusMin), unit: "min", icon: "⏱", color: "#22c55e" },
          { label: "Distraction Time", value: Math.round(distTotal), unit: "min", icon: "😴", color: "#f97316" },
          { label: "Focus Score", value: focusScore, unit: "%", icon: "🎯", color: "#a855f7", sub: hasData ? null : "no data" },
          { label: "Goal Progress", value: goalPct, unit: "%", icon: "📊", color: "#3b82f6", sub: `of ${todayGoal}m` },
        ].map((s, i) => (
          <StatTile key={s.label} {...s} index={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <Card className="p-6 flex flex-col items-center justify-center fu-stagger" style={{ "--fu-i": 0 }}>
          <SectionTitle title="Focus Score" subtitle="Share of tracked time spent focused" className="mb-5 w-full" />
          <ProgressRing pct={focusScore} color="#a855f7" size={148} stroke={12}>
            <p className="text-3xl font-bold" style={{ color: "#a855f7" }}>{focusScore}<span className="text-lg">%</span></p>
            <p className="text-[11px] text-slate-500 mt-0.5">focused</p>
          </ProgressRing>
          <p className="text-xs font-semibold mt-4" style={{ color: scoreVerdict.color }}>{scoreVerdict.text}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {Math.round(focusMin)}m focused of {Math.round(trackedTotal)}m tracked
          </p>
        </Card>

        <Card className="p-6 xl:col-span-2 fu-stagger" style={{ "--fu-i": 1 }}>
          <SectionTitle
            title="Time Breakdown"
            subtitle="How this session's tracked minutes were spent"
            className="mb-5"
          />
          {hasData ? (
            <>
              {/* Single stacked rail — the shape of the session at a glance,
                  before the per-state detail below. */}
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-200 mb-5">
                {dailySummary.filter((i) => i.pct > 0).map((item) => (
                  <div
                    key={item.label}
                    title={`${item.label}: ${item.value}m`}
                    className="h-full transition-all duration-700"
                    style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                  />
                ))}
              </div>
              <div className="space-y-3">
                {dailySummary.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border p-3"
                    style={{ backgroundColor: `${item.color}08`, borderColor: `${item.color}20` }}
                  >
                    <div className="flex justify-between items-center text-sm mb-2 gap-2">
                      <span className="flex items-center gap-2" style={{ color: item.color }}>
                        <span className="text-base">{item.icon}</span>
                        {item.label}
                      </span>
                      <span className="font-bold whitespace-nowrap" style={{ color: item.color }}>
                        {item.value}m
                        <span className="text-xs font-semibold opacity-70 ml-1.5">{Math.round(item.pct)}%</span>
                      </span>
                    </div>
                    <Meter pct={item.pct} color={item.color} height={8} glow />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon="📷"
              title="No tracked time yet"
              hint="Open Live Monitoring and start a session — this breakdown fills in as detections come in."
            />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 fu-stagger" style={{ "--fu-i": 2 }}>
          <SectionTitle title="Daily Goal" subtitle={`${Math.round(focusMin)} / ${todayGoal} focused minutes`} className="mb-4" />
          <div className="flex items-baseline gap-2 mb-3">
            <p className="text-4xl font-bold" style={{ color: "#22c55e" }}>{goalPct}<span className="text-xl">%</span></p>
            <span className="text-xs text-slate-500">
              {focusMin >= todayGoal ? "complete" : `${Math.max(todayGoal - Math.round(focusMin), 0)}m remaining`}
            </span>
          </div>
          <Meter pct={goalPct} color="#22c55e" height={12} glow sheen />
          {focusMin >= todayGoal && (
            <p className="text-xs mt-3 font-semibold" style={{ color: "#22c55e" }}>🎉 Goal achieved! +100 bonus pts</p>
          )}
        </Card>

        <Card className="p-6 fu-stagger" style={{ "--fu-i": 3 }}>
          <SectionTitle title="Session Totals" className="mb-2" />
          <div>
            <DataRow icon="⏱" label="Focus Time" value={`${Math.round(focusMin)} min`} color="#22c55e" />
            <DataRow icon="✦" label="Total Points" value={`${points.toLocaleString()} pts`} color="#f59e0b" />
            {rankedDistractions.map((d) => (
              <DataRow key={d.key} icon={d.icon} label={`${d.key} Time`} value={`${d.value} min`} color={d.color} />
            ))}
            <DataRow icon="🏆" label="Team Rank" value={`#${myRank}`} color="#a855f7" last />
          </div>
        </Card>

        <Card className="p-6 fu-stagger" style={{ "--fu-i": 4 }}>
          <SectionTitle title="Session Notes" subtitle="Generated from this session's data" className="mb-4" />
          <div className="space-y-3">
            {notes.map((ins, i) => (
              <div
                key={i}
                className="flex gap-3 p-3 rounded-xl border"
                style={{ borderColor: `${ins.color}25`, backgroundColor: `${ins.color}08` }}
              >
                <span className="text-lg shrink-0 leading-none mt-0.5">{ins.icon}</span>
                <p className="text-xs text-slate-700 leading-relaxed">{ins.text}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
