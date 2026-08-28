import React from "react";
import Card from "../Card";
import { PageHeader, SectionTitle, Meter, ProgressRing, Badge } from "../ui";

function AchievementCard({ a, index }) {
  const color = a.earned ? "#f59e0b" : "#64748b";
  return (
    <Card
      hover
      className="p-5 fu-stagger relative overflow-hidden"
      style={{
        "--fu-i": index,
        borderColor: a.earned ? "#f59e0b35" : "rgba(0,0,0,0.05)",
        backgroundColor: a.earned ? "rgba(245,158,11,0.05)" : "rgba(255,255,255,0.35)",
      }}
    >
      {a.earned && (
        <span className="absolute top-3 right-3 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>
          Earned
        </span>
      )}
      <div className="flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
          style={{
            backgroundColor: a.earned ? "#f59e0b15" : "rgba(0,0,0,0.04)",
            border: `1px solid ${a.earned ? "#f59e0b30" : "rgba(0,0,0,0.06)"}`,
            boxShadow: a.earned ? "0 0 18px #f59e0b25" : "none",
            filter: a.earned ? "none" : "grayscale(1)",
            opacity: a.earned ? 1 : 0.7,
          }}
        >
          {a.earned ? a.icon : "🔒"}
        </div>
        <div className="flex-1 min-w-0 pr-12">
          <p className="font-semibold text-sm mb-0.5" style={{ color }}>{a.name}</p>
          <p className="text-xs text-slate-600 leading-relaxed">{a.desc}</p>
          <div
            className="mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ backgroundColor: a.earned ? "#f59e0b15" : "rgba(0,0,0,0.04)", color: a.earned ? "#f59e0b" : "#78716c" }}
          >
            ✦ {a.pts} pts
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function TabAchievements({ ACHIEVEMENTS_LIST }) {
  const earned = ACHIEVEMENTS_LIST.filter((a) => a.earned);
  const locked = ACHIEVEMENTS_LIST.filter((a) => !a.earned);
  const earnedPts = earned.reduce((s, a) => s + a.pts, 0);
  const totalPts = ACHIEVEMENTS_LIST.reduce((s, a) => s + a.pts, 0);
  const completion = ACHIEVEMENTS_LIST.length
    ? Math.round((earned.length / ACHIEVEMENTS_LIST.length) * 100)
    : 0;

  return (
    <div className="fu-view">
      <PageHeader
        icon="🏅"
        title="Achievements"
        subtitle="Badges unlock from your saved focus history, not dummy flags"
        right={<Badge color="#f59e0b">{earned.length} / {ACHIEVEMENTS_LIST.length} unlocked</Badge>}
      />

      <Card className="p-6 mb-4 fu-stagger" style={{ "--fu-i": 0 }}>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ProgressRing pct={completion} color="#f59e0b" size={120} stroke={11}>
            <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>{completion}<span className="text-sm">%</span></p>
            <p className="text-[11px] text-slate-500">complete</p>
          </ProgressRing>

          <div className="flex-1 w-full">
            <SectionTitle
              title="Collection Progress"
              subtitle={`${earnedPts.toLocaleString()} of ${totalPts.toLocaleString()} achievement points collected`}
              className="mb-4"
            />
            <Meter pct={totalPts ? (earnedPts / totalPts) * 100 : 0} color="#f59e0b" height={10} glow sheen />
            <div className="grid grid-cols-3 gap-3 mt-5">
              {[
                { label: "Earned", value: earned.length, color: "#22c55e" },
                { label: "Locked", value: locked.length, color: "#64748b" },
                { label: "Total Pts", value: earnedPts, color: "#f59e0b" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="text-center rounded-xl border py-3"
                  style={{ borderColor: `${s.color}25`, backgroundColor: `${s.color}08` }}
                >
                  <p className="text-2xl font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs text-slate-600 mt-1.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {earned.length > 0 && (
        <>
          <SectionTitle title="Unlocked" subtitle="Badges earned from persisted time and streaks" className="mb-3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {earned.map((a, i) => <AchievementCard key={a.id} a={a} index={i} />)}
          </div>
        </>
      )}

      {locked.length > 0 && (
        <>
          <SectionTitle title="Still Locked" subtitle="Keep focusing to unlock these" className="mb-3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {locked.map((a, i) => <AchievementCard key={a.id} a={a} index={i} />)}
          </div>
        </>
      )}
    </div>
  );
}
