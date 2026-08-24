import React from "react";
import Card from "../Card";
import { PageHeader, SectionTitle, StatTile, Meter, Badge, DataRow, ProgressRing, EmptyState } from "../ui";
import { dayDistMin, dayFocusMin, formatHM, todayISO, weekdayShort } from "../../../lib/focusTime";

const BREAKDOWN = [
  { key: "focus", label: "Focus", icon: "🎯", color: "#22c55e" },
  { key: "distraction", label: "Distraction", icon: "😴", color: "#f97316" },
];

export default function TabReport({ focusMin, distMin, todayFocusMin = 0, todayDistMin = 0, todayGoal, week }) {
  const trackedTotal = focusMin + distMin;
  const hasData = trackedTotal > 0;
  const focusScore = hasData ? Math.round((focusMin / trackedTotal) * 100) : 0;
  const goalPct = Math.round(Math.min((todayFocusMin / todayGoal) * 100, 100));
  const fmt = (n) => formatHM(n, { allowSeconds: true });

  const dailySummary = BREAKDOWN.map((item) => {
    const value = item.key === "focus" ? focusMin : distMin;
    return {
      ...item,
      value,
      pct: hasData ? (value / trackedTotal) * 100 : 0,
    };
  });

  const scoreVerdict = !hasData
    ? { text: "Awaiting data", color: "#64748b" }
    : focusScore >= 80
      ? { text: "Excellent focus", color: "#22c55e" }
      : focusScore >= 60
        ? { text: "Solid session", color: "#f59e0b" }
        : { text: "Room to improve", color: "#f97316" };

  const notes = [
    !hasData
      ? { icon: "📷", text: "No detections yet this session — start Live Monitoring with your face in frame.", color: "#64748b" }
      : null,
    distMin > 0
      ? { icon: "⏱", text: `${fmt(distMin)} of overall distraction time in this session.`, color: "#f97316" }
      : hasData
        ? { icon: "🎯", text: "No distraction time in this session — keep it up.", color: "#22c55e" }
        : null,
    week?.insight
      ? { icon: "📅", text: week.insight, color: "#64748b" }
      : null,
    todayFocusMin >= todayGoal
      ? { icon: "🎉", text: `You've hit today's ${formatHM(todayGoal)} focus goal!`, color: "#22c55e" }
      : { icon: "⏱", text: `${formatHM(Math.max(todayGoal - todayFocusMin, 0))} more focused time today to reach the daily goal (${formatHM(todayFocusMin)} so far today).`, color: "#3b82f6" },
  ].filter(Boolean);

  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="fu-view">
      <PageHeader
        icon="📈"
        title="Session Report"
        subtitle="This live session only — today's saved totals stay on the Dashboard"
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
          { label: "Focus Time", value: fmt(focusMin), icon: "⏱", color: "#22c55e" },
          { label: "Distraction Time", value: fmt(distMin), icon: "😴", color: "#f97316" },
          { label: "Focus Score", value: focusScore, unit: "%", icon: "🎯", color: "#a855f7", sub: hasData ? null : "no data" },
          { label: "Goal Progress", value: goalPct, unit: "%", icon: "📊", color: "#3b82f6", sub: `today ${formatHM(todayFocusMin)}` },
        ].map((s, i) => (
          <StatTile key={s.label} {...s} index={i} />
        ))}
      </div>

      <Card className="p-6 mb-4 fu-stagger" style={{ "--fu-i": 0 }}>
        <SectionTitle
          title="This week"
          subtitle={
            week
              ? `${formatHM(week.totalFocus || 0)} focused · ${formatHM(week.totalDist || 0)} distracted`
              : "Loading saved days…"
          }
          className="mb-5"
        />
        {(week?.days || []).length === 0 ? (
          <EmptyState icon="📅" title="No weekly data yet" hint="Keep a session running — each day is stored in the database." />
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {(week.days || []).map((d) => {
              const f = dayFocusMin(d);
              const dist = dayDistMin(d);
              const tracked = f + dist;
              const isToday = d.date === todayISO();
              const maxTracked = Math.max(...(week.days || []).map((x) => dayFocusMin(x) + dayDistMin(x)), 1);
              return (
                <div
                  key={d.date}
                  className="rounded-xl border p-2 text-center"
                  style={{
                    borderColor: isToday ? "#22c55e40" : "rgba(0,0,0,0.06)",
                    backgroundColor: isToday ? "#22c55e08" : "transparent",
                  }}
                >
                  <p className="text-[11px] font-semibold text-slate-500 mb-2">{weekdayShort(d.date)}</p>
                  <div className="h-16 flex items-end justify-center gap-0.5">
                    <div
                      className="w-2.5 rounded-t"
                      title={`Focus ${formatHM(f)}`}
                      style={{ height: `${Math.max((f / maxTracked) * 100, tracked ? 4 : 0)}%`, backgroundColor: "#22c55e" }}
                    />
                    <div
                      className="w-2.5 rounded-t"
                      title={`Distraction ${formatHM(dist)}`}
                      style={{ height: `${Math.max((dist / maxTracked) * 100, dist ? 4 : 0)}%`, backgroundColor: "#f97316" }}
                    />
                  </div>
                  <p className="text-[10px] font-bold mt-2" style={{ color: "#22c55e" }}>{formatHM(f)}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <Card className="p-6 flex flex-col items-center justify-center fu-stagger" style={{ "--fu-i": 0 }}>
          <SectionTitle title="Focus Score" subtitle="Share of tracked time spent focused" className="mb-5 w-full" />
          <ProgressRing pct={focusScore} color="#a855f7" size={148} stroke={12}>
            <p className="text-3xl font-bold" style={{ color: "#a855f7" }}>{focusScore}<span className="text-lg">%</span></p>
            <p className="text-[11px] text-slate-500 mt-0.5">focused</p>
          </ProgressRing>
          <p className="text-xs font-semibold mt-4" style={{ color: scoreVerdict.color }}>{scoreVerdict.text}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {fmt(focusMin)} focused of {fmt(trackedTotal)} this session
          </p>
        </Card>

        <Card className="p-6 xl:col-span-2 fu-stagger" style={{ "--fu-i": 1 }}>
          <SectionTitle
            title="Time Breakdown"
            subtitle="Focus vs overall distraction this session"
            className="mb-5"
          />
          {hasData ? (
            <>
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-200 mb-5">
                {dailySummary.filter((i) => i.pct > 0).map((item) => (
                  <div
                    key={item.label}
                    title={`${item.label}: ${fmt(item.value)}`}
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
                        {fmt(item.value)}
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
              hint="Open Live Monitoring with your face in frame — this breakdown is this session only, starting at zero."
            />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 fu-stagger" style={{ "--fu-i": 2 }}>
          <SectionTitle title="Daily Goal" subtitle={`${formatHM(todayFocusMin)} / ${formatHM(todayGoal)} focused today`} className="mb-4" />
          <div className="flex items-baseline gap-2 mb-3">
            <p className="text-4xl font-bold" style={{ color: "#22c55e" }}>{goalPct}<span className="text-xl">%</span></p>
            <span className="text-xs text-slate-500">
              {todayFocusMin >= todayGoal ? "complete" : `${formatHM(Math.max(todayGoal - todayFocusMin, 0))} remaining today`}
            </span>
          </div>
          <Meter pct={goalPct} color="#22c55e" height={12} glow sheen />
          {todayFocusMin >= todayGoal && (
            <p className="text-xs mt-3 font-semibold" style={{ color: "#22c55e" }}>🎉 Goal achieved!</p>
          )}
        </Card>

        <Card className="p-6 fu-stagger" style={{ "--fu-i": 3 }}>
          <SectionTitle title="Session Totals" className="mb-2" />
          <div>
            <DataRow icon="⏱" label="Focus Time" value={fmt(focusMin)} color="#22c55e" />
            <DataRow icon="😴" label="Distraction Time" value={fmt(distMin)} color="#f97316" />
            <DataRow icon="📊" label="Tracked Time" value={fmt(trackedTotal)} color="#64748b" />
            <DataRow icon="📅" label="Today (saved + session)" value={formatHM(todayFocusMin + todayDistMin)} color="#a855f7" last />
          </div>
        </Card>

        <Card className="p-6 fu-stagger" style={{ "--fu-i": 4 }}>
          <SectionTitle title="Session Notes" subtitle="From this session's detections" className="mb-4" />
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
