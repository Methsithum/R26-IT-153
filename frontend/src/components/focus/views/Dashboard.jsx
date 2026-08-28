import React from "react";
import Card from "../Card";
import TreeSVG from "../TreeSVG";
import { STATE_CFG, LEVEL_DATA, TREE_MOOD } from "../focusData";
import { PageHeader, SectionTitle, Meter, Badge, EmptyState } from "../ui";
import { dayFocusMin, formatHM, todayISO, weekdayShort } from "../../../lib/focusTime";

export default function TabDashboard({
  state,
  focusMin,
  streak,
  ACHIEVEMENTS_LIST,
  LEVEL_DATA: LD = LEVEL_DATA,
  todayGoal,
  distMin,
  lifetimeMin,
  week,
}) {
  const cfg = STATE_CFG[state] || STATE_CFG.Focused;
  const mood = TREE_MOOD[state] || TREE_MOOD.Focused;
  const lv = Math.max(0, LD.filter((l) => lifetimeMin >= l.min).length - 1);
  const current = LD[lv];
  const next = LD[lv + 1];
  const goalPct = Math.min((focusMin / todayGoal) * 100, 100);
  const nextMin = next ? next.min : current.min;
  const lvPct = next ? ((lifetimeMin - current.min) / (next.min - current.min)) * 100 : 100;
  const trackedTotal = focusMin + distMin;
  const distPct = trackedTotal > 0 ? (distMin / trackedTotal) * 100 : 0;
  const earnedAchievements = ACHIEVEMENTS_LIST.filter((a) => a.earned);
  const weekDays = week?.days || [];
  const topDayMin = weekDays.reduce((max, d) => Math.max(max, dayFocusMin(d)), 0);
  const today = todayISO();

  const stats = [
    { label: "Focus today", value: formatHM(focusMin), icon: "⏱", color: "#22c55e" },
    { label: "Streak", value: `${streak}m`, icon: "🔥", color: "#f97316" },
    { label: "All-time", value: formatHM(lifetimeMin), icon: "🌳", color: "#a855f7" },
    { label: "Off-task", value: formatHM(distMin), icon: "😔", color: "#64748b" },
  ];

  return (
    <div className="fu-view space-y-4">
      <PageHeader
        icon="🌿"
        title="Dashboard"
        subtitle="Your tree is happy when this session is mostly focused, droopy when distraction leads"
        right={<Badge color={cfg.color}>{mood.emoji} {cfg.label}</Badge>}
      />

      <Card
        className="overflow-hidden fu-stagger"
        style={{
          "--fu-i": 0,
          borderColor: `${cfg.color}28`,
          background: `linear-gradient(135deg, ${cfg.color}18 0%, rgba(255,255,255,0.72) 42%, rgba(255,255,255,0.55) 100%)`,
          boxShadow: `0 20px 50px -24px ${cfg.color}55`,
        }}
      >
        <div className="grid grid-cols-12">
          <div className="col-span-12 lg:col-span-5 relative flex flex-col items-center justify-center px-6 pt-8 pb-6">
            <div
              className="absolute inset-6 rounded-[2rem] pointer-events-none"
              style={{ background: `radial-gradient(circle at 50% 40%, ${cfg.color}22, transparent 62%)` }}
            />
            <div className="relative">
              <TreeSVG state={state} points={lifetimeMin} size={220} />
              <div
                className="absolute -right-2 top-6 px-3 py-2 rounded-2xl rounded-bl-md text-sm font-semibold shadow-sm border"
                style={{
                  backgroundColor: "rgba(255,255,255,0.92)",
                  borderColor: `${cfg.color}30`,
                  color: cfg.color,
                }}
              >
                {mood.emoji} {state === "Focused" ? "Happy!" : state === "Fatigue" ? "Sleepy…" : state === "Anxiety" ? "Nervous" : state === "Boredom" ? "Sad…" : "Waiting…"}
              </div>
            </div>
            <p className="relative text-center text-sm font-semibold mt-1 max-w-xs leading-snug" style={{ color: cfg.color }}>
              {mood.line}
            </p>
            <div className="relative mt-3">
              <Badge color={lv === 3 ? "#f59e0b" : cfg.color}>{current.icon} {current.name}</Badge>
            </div>
            <div className="relative w-full max-w-[220px] mt-3">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-500">Level {lv + 1}</span>
                <span className="font-semibold" style={{ color: cfg.color }}>
                  {next ? `${formatHM(Math.max(nextMin - lifetimeMin, 0))} to go` : "Max"}
                </span>
              </div>
              <Meter pct={lvPct} color={lv === 3 ? "#f59e0b" : cfg.color} height={8} glow sheen={!!next} />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 p-5 lg:p-6 lg:border-l border-white/40">
            <div className="flex items-center gap-3 mb-5">
              <span
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}
              >
                {mood.emoji}
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Live mood</p>
                <p className="text-2xl font-bold leading-tight" style={{ color: cfg.color }}>{cfg.label}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border p-3.5"
                  style={{
                    borderColor: `${s.color}22`,
                    backgroundColor: "rgba(255,255,255,0.55)",
                  }}
                >
                  <p className="text-[11px] text-slate-500 mb-1">{s.icon} {s.label}</p>
                  <p className="text-xl font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: "#22c55e28", backgroundColor: "rgba(255,255,255,0.5)" }}
            >
              <SectionTitle
                title="Daily goal"
                subtitle={`${formatHM(focusMin)} / ${formatHM(todayGoal)} focused`}
                right={<span className="text-2xl font-bold" style={{ color: "#22c55e" }}>{Math.round(goalPct)}%</span>}
                className="mb-3"
              />
              <Meter pct={goalPct} color="#22c55e" height={12} glow sheen />
              {goalPct >= 100 && (
                <p className="text-xs mt-2 font-semibold" style={{ color: "#22c55e" }}>🎉 Goal achieved!</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-7 flex flex-col gap-4">
          <Card className="p-5 fu-stagger" style={{ "--fu-i": 1 }}>
            <SectionTitle
              title="Today's balance"
              subtitle={distMin > 0 ? `${formatHM(distMin)} distracted · ${Math.round(distPct)}% of tracked time` : "Nothing but focus so far"}
              className="mb-4"
            />
            <div className="flex h-3.5 rounded-full overflow-hidden bg-slate-200 mb-4">
              {focusMin > 0 && (
                <div className="h-full" style={{ width: `${100 - distPct}%`, backgroundColor: "#22c55e" }} title={`Focus ${formatHM(focusMin)}`} />
              )}
              {distMin > 0 && (
                <div className="h-full" style={{ width: `${distPct}%`, backgroundColor: "#f97316" }} title={`Distraction ${formatHM(distMin)}`} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border p-3" style={{ borderColor: "#22c55e22", backgroundColor: "#22c55e08" }}>
                <p className="text-[11px] text-slate-500">😊 Focused</p>
                <p className="text-lg font-bold" style={{ color: "#22c55e" }}>{formatHM(focusMin)}</p>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: "#f9731622", backgroundColor: "#f9731608" }}>
                <p className="text-[11px] text-slate-500">😔 Distracted</p>
                <p className="text-lg font-bold" style={{ color: "#f97316" }}>{formatHM(distMin)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 fu-stagger" style={{ "--fu-i": 2 }}>
            <SectionTitle title="Recent badges" className="mb-3" />
            {earnedAchievements.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {earnedAchievements.slice(0, 6).map((a) => (
                  <div
                    key={a.id}
                    title={a.desc}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold"
                    style={{ borderColor: "#f59e0b35", backgroundColor: "#f59e0b0c", color: "#d97706" }}
                  >
                    {a.icon} {a.name}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No badges yet — 25 focused minutes unlocks the first one.</p>
            )}
          </Card>
        </div>

        <div className="col-span-12 md:col-span-5">
          <Card className="p-5 h-full fu-stagger" style={{ "--fu-i": 3 }}>
            <SectionTitle
              title="This week"
              subtitle={week ? `${formatHM(week.totalFocus || 0)} focused` : "Loading…"}
              className="mb-5"
            />
            {weekDays.length === 0 ? (
              <EmptyState icon="📅" title="No week loaded" hint="Start the backend to see saved days." />
            ) : (
              <div className="flex items-end gap-2 h-36">
                {weekDays.map((d) => {
                  const mins = dayFocusMin(d);
                  const isToday = d.date === today;
                  const h = topDayMin > 0 ? Math.max((mins / topDayMin) * 100, mins > 0 ? 8 : 4) : 4;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-[10px] font-bold text-slate-500">{formatHM(mins)}</span>
                      <div
                        className="w-full rounded-t-xl transition-all"
                        title={`${weekdayShort(d.date)} · ${formatHM(mins)}`}
                        style={{
                          height: `${h}%`,
                          backgroundColor: isToday ? cfg.color : "#cbd5e1",
                          boxShadow: isToday ? `0 0 12px ${cfg.color}40` : "none",
                        }}
                      />
                      <span className="text-[10px] font-semibold" style={{ color: isToday ? cfg.color : "#94a3b8" }}>
                        {weekdayShort(d.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
