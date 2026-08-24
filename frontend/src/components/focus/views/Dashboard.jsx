import React from "react";
import Card from "../Card";
import TreeSVG from "../TreeSVG";
import { STATE_CFG, LEVEL_DATA } from "../focusData";
import { PageHeader, SectionTitle, StatTile, Meter, Badge, EmptyState } from "../ui";
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
  const lv = Math.max(0, LD.filter((l) => lifetimeMin >= l.min).length - 1);
  const current = LD[lv];
  const next = LD[lv + 1];
  const goalPct = Math.min((focusMin / todayGoal) * 100, 100);
  const nextMin = next ? next.min : current.min;
  const lvPct = next ? ((lifetimeMin - current.min) / (next.min - current.min)) * 100 : 100;
  const trackedTotal = focusMin + distMin;
  const earnedAchievements = ACHIEVEMENTS_LIST.filter((a) => a.earned);
  const weekDays = week?.days || [];
  const topDayMin = weekDays.reduce((max, d) => Math.max(max, dayFocusMin(d)), 0);
  const today = todayISO();

  return (
    <div className="fu-view">
      <PageHeader
        icon="📊"
        title="Dashboard"
        subtitle="Today's tracked time, loaded from your saved report"
        right={<Badge color={cfg.color}>{cfg.icon} {cfg.label}</Badge>}
      />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
          <Card
            className="p-5 transition-all duration-700 fu-stagger"
            style={{
              "--fu-i": 0,
              background: `linear-gradient(135deg,${cfg.color}12,rgba(255,255,255,0.5))`,
              borderColor: cfg.border,
              boxShadow: `0 0 30px ${cfg.color}12`,
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                style={{ backgroundColor: `${cfg.color}12`, border: `1px solid ${cfg.color}25` }}
              >
                {cfg.icon}
              </span>
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-widest">Current State</p>
                <p className="text-2xl font-bold leading-tight" style={{ color: cfg.color }}>{cfg.label}</p>
              </div>
            </div>
            <div className="flex gap-1">
              {Object.entries(STATE_CFG).map(([s, c]) => (
                <div
                  key={s}
                  title={c.label}
                  className="flex-1 h-1.5 rounded-full transition-all duration-500"
                  style={{ backgroundColor: state === s ? c.color : `${c.color}25` }}
                />
              ))}
            </div>
          </Card>

          <Card className="p-5 flex flex-col items-center fu-stagger" style={{ "--fu-i": 1 }}>
            <TreeSVG state={state} points={lifetimeMin} size={160} />
            <div className="text-center mt-2">
              <Badge color={lv === 3 ? "#f59e0b" : cfg.color}>{current.icon} {current.name}</Badge>
            </div>
          </Card>

          <Card className="p-4 fu-stagger" style={{ "--fu-i": 2 }}>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-600">Level {lv + 1} Progress</span>
              <span className="font-semibold" style={{ color: "#f59e0b" }}>
                {formatHM(lifetimeMin)}{next ? ` / ${formatHM(nextMin)}` : ""}
              </span>
            </div>
            <Meter pct={lvPct} color="#f59e0b" height={8} glow sheen={!!next} />
            <p className="text-xs text-slate-600 mt-2">
              {next ? `${formatHM(Math.max(nextMin - lifetimeMin, 0))} to ${next.name}` : "🏆 Max level reached!"}
            </p>
          </Card>
        </div>

        <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Focus Today", value: formatHM(focusMin), icon: "⏱", color: "#22c55e" },
              { label: "Streak", value: streak, unit: "m", icon: "🔥", color: "#f97316" },
              { label: "All-time", value: formatHM(lifetimeMin), icon: "🌳", color: "#a855f7" },
            ].map((s, i) => (
              <StatTile key={s.label} {...s} index={i} />
            ))}
          </div>

          <Card className="p-5 fu-stagger" style={{ "--fu-i": 3 }}>
            <SectionTitle
              title="Daily Goal"
              subtitle={`${formatHM(focusMin)} / ${formatHM(todayGoal)} focused`}
              right={<span className="text-2xl font-bold" style={{ color: "#22c55e" }}>{Math.round(goalPct)}%</span>}
              className="mb-3"
            />
            <Meter pct={goalPct} color="#22c55e" height={12} glow sheen />
            {goalPct >= 100 && (
              <p className="text-xs mt-2 font-semibold" style={{ color: "#22c55e" }}>🎉 Goal achieved!</p>
            )}
          </Card>

          <Card className="p-5 fu-stagger" style={{ "--fu-i": 4 }}>
            <SectionTitle
              title="Today's Distraction Time"
              subtitle={distMin > 0 ? `${formatHM(distMin)} off-task so far` : null}
              className="mb-4"
            />
            {distMin > 0 ? (
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-3xl font-bold" style={{ color: "#f97316" }}>{formatHM(distMin)}</span>
                  <span className="text-xs text-slate-500">
                    {trackedTotal > 0 ? `${Math.round((distMin / trackedTotal) * 100)}% of tracked time` : null}
                  </span>
                </div>
                <Meter
                  pct={trackedTotal > 0 ? (distMin / trackedTotal) * 100 : 0}
                  color="#f97316"
                  height={8}
                  glow
                />
              </div>
            ) : (
              <EmptyState icon="🎯" title="No distractions detected" hint="Nothing but focus so far this session — keep it up." />
            )}
          </Card>

          <Card className="p-4 fu-stagger" style={{ "--fu-i": 5 }}>
            <SectionTitle title="Recent Achievements" className="mb-3" />
            {earnedAchievements.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {earnedAchievements.slice(0, 4).map((a) => (
                  <div
                    key={a.id}
                    title={a.desc}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold"
                    style={{ borderColor: "#f59e0b35", backgroundColor: "#f59e0b08", color: "#f59e0b" }}
                  >
                    {a.icon} {a.name}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No badges yet — your first unlocks after 25 focused minutes.</p>
            )}
          </Card>
        </div>

        <div className="col-span-12 md:col-span-3">
          <Card className="p-5 h-full fu-stagger" style={{ "--fu-i": 6 }}>
            <SectionTitle
              title="This week"
              subtitle={week ? `${formatHM(week.totalFocus || 0)} focused` : "Loading…"}
              className="mb-4"
            />
            {weekDays.length === 0 ? (
              <EmptyState icon="📅" title="No week loaded" hint="Start the backend to see saved days." />
            ) : (
              <div className="space-y-2">
                {weekDays.map((d) => {
                  const mins = dayFocusMin(d);
                  const isToday = d.date === today;
                  return (
                    <div
                      key={d.date}
                      className="flex items-center gap-2 p-2.5 rounded-xl border"
                      style={{
                        borderColor: isToday ? "#22c55e30" : "rgba(0,0,0,0.05)",
                        backgroundColor: isToday ? "#22c55e08" : "transparent",
                      }}
                    >
                      <span className="text-xs w-8 font-bold" style={{ color: isToday ? "#22c55e" : "#64748b" }}>
                        {weekdayShort(d.date)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <Meter
                          pct={topDayMin > 0 ? (mins / topDayMin) * 100 : 0}
                          color={isToday ? "#22c55e" : "#334155"}
                          height={4}
                        />
                      </div>
                      <span className="text-xs text-slate-600 font-bold whitespace-nowrap">{formatHM(mins)}</span>
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
