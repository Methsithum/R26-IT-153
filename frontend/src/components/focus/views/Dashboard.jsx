import React from "react";
import Card from "../Card";
import TreeSVG from "../TreeSVG";
import { STATE_CFG, LEVEL_DATA } from "../focusData";
import { PageHeader, SectionTitle, StatTile, Meter, Badge, EmptyState } from "../ui";

const DISTRACTIONS = [
  { k: "Fatigue", icon: "😴", c: "#f97316" },
  { k: "Anxiety", icon: "😰", c: "#ef4444" },
  { k: "Boredom", icon: "😑", c: "#3b82f6" },
];

export default function TabDashboard({ state, points, focusMin, streak, TEAM, ACHIEVEMENTS_LIST, LEVEL_DATA: LD = LEVEL_DATA, todayGoal, dist, myRank }) {
  const cfg = STATE_CFG[state] || STATE_CFG.Focused;
  const lv = LD.filter((l) => points >= l.min).length - 1;
  const current = LD[lv];
  const next = LD[lv + 1];
  const sortedTeam = [...TEAM].sort((a, b) => b.pts - a.pts);
  const topPts = sortedTeam[0]?.pts || 0;

  const goalPct = Math.min((focusMin / todayGoal) * 100, 100);

  // Level thresholds come from LEVEL_DATA rather than a parallel hardcoded list,
  // so editing a level's `min` in one place stays correct here.
  const nextPts = next ? next.min : current.min;
  const lvPct = next ? ((points - current.min) / (next.min - current.min)) * 100 : 100;

  const distTotal = Object.values(dist).reduce((a, b) => a + b, 0);
  const earnedAchievements = ACHIEVEMENTS_LIST.filter((a) => a.earned);

  return (
    <div className="fu-view">
      <PageHeader
        icon="📊"
        title="Dashboard"
        subtitle="Everything from your current focus session, at a glance"
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
            <TreeSVG state={state} points={points} size={160} />
            <div className="text-center mt-2">
              <Badge color={lv === 3 ? "#f59e0b" : cfg.color}>{current.icon} {current.name}</Badge>
            </div>
          </Card>

          <Card className="p-4 fu-stagger" style={{ "--fu-i": 2 }}>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-600">Level {lv + 1} Progress</span>
              <span className="font-semibold" style={{ color: "#f59e0b" }}>
                {points.toLocaleString()}{next ? ` / ${nextPts.toLocaleString()}` : ""}
              </span>
            </div>
            <Meter pct={lvPct} color="#f59e0b" height={8} glow sheen={!!next} />
            <p className="text-xs text-slate-600 mt-2">
              {next ? `${nextPts - points} pts to ${next.name}` : "🏆 Max level reached!"}
            </p>
          </Card>
        </div>

        <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Focus Time", value: Math.round(focusMin), unit: "m", icon: "⏱", color: "#22c55e" },
              { label: "Streak", value: streak, unit: "m", icon: "🔥", color: "#f97316" },
              { label: "Rank", value: `#${myRank}`, icon: "🏆", color: "#a855f7" },
            ].map((s, i) => (
              <StatTile key={s.label} {...s} index={i} />
            ))}
          </div>

          <Card className="p-5 fu-stagger" style={{ "--fu-i": 3 }}>
            <SectionTitle
              title="Daily Goal"
              subtitle={`${Math.round(focusMin)} / ${todayGoal} min focused`}
              right={<span className="text-2xl font-bold" style={{ color: "#22c55e" }}>{Math.round(goalPct)}%</span>}
              className="mb-3"
            />
            <Meter pct={goalPct} color="#22c55e" height={12} glow sheen />
            {goalPct >= 100 && (
              <p className="text-xs mt-2 font-semibold" style={{ color: "#22c55e" }}>🎉 Goal achieved! +100 bonus pts</p>
            )}
          </Card>

          <Card className="p-5 fu-stagger" style={{ "--fu-i": 4 }}>
            <SectionTitle
              title="Today's Distraction Breakdown"
              subtitle={distTotal > 0 ? `${Math.round(distTotal)}m distracted so far` : null}
              className="mb-4"
            />
            {distTotal > 0 ? (
              <div className="space-y-3.5">
                {DISTRACTIONS.map((d) => {
                  const val = dist[d.k] || 0;
                  const pct = (val / distTotal) * 100;
                  return (
                    <div key={d.k}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-slate-700">{d.icon} {d.k}</span>
                        <span style={{ color: d.c }}>{val}m <span className="opacity-70">({Math.round(pct)}%)</span></span>
                      </div>
                      <Meter pct={pct} color={d.c} height={6} glow />
                    </div>
                  );
                })}
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
            <SectionTitle title="🏆 Team" subtitle="Session standings" className="mb-4" />
            <div className="space-y-2">
              {sortedTeam.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 p-2.5 rounded-xl border transition-all"
                  style={{
                    borderColor: m.isMe ? "#22c55e30" : "rgba(0,0,0,0.05)",
                    backgroundColor: m.isMe ? "#22c55e08" : "transparent",
                  }}
                >
                  <span className="text-sm w-5 text-center font-bold" style={{ color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : "#78716c" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                  </span>
                  <span className="text-lg">{m.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: m.isMe ? "#22c55e" : "#334155" }}>
                      {m.name}{m.isMe ? " (You)" : ""}
                    </p>
                    <div className="mt-1">
                      <Meter
                        pct={topPts > 0 ? (m.pts / topPts) * 100 : 0}
                        color={m.isMe ? "#22c55e" : "#334155"}
                        height={4}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 font-bold">{m.pts}</span>
                </div>
              ))}
            </div>
            {myRank > 1 && sortedTeam[myRank - 2] && (
              <div className="mt-3 p-2.5 rounded-xl border" style={{ borderColor: "#22c55e26", backgroundColor: "#22c55e0d" }}>
                <p className="text-xs" style={{ color: "#22c55e" }}>
                  💪 {sortedTeam[myRank - 2].pts - sortedTeam[myRank - 1].pts} pts to #{myRank - 1}!
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
