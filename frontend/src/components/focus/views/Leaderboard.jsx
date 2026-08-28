import React from "react";
import Card from "../Card";
import { PageHeader, SectionTitle, Meter, Badge, EmptyState } from "../ui";
import { dayFocusMin, formatHM, todayISO, weekdayShort } from "../../../lib/focusTime";

export default function TabLeaderboard({ focusMin, distMin, streak, longestStreak, lifetimeMin, week }) {
  const weekDays = [...(week?.days || [])].sort((a, b) => dayFocusMin(b) - dayFocusMin(a));
  const topFocus = weekDays.reduce((max, d) => Math.max(max, dayFocusMin(d)), 0);
  const today = todayISO();
  const hasToday = focusMin > 0 || distMin > 0;

  return (
    <div className="fu-view">
      <PageHeader
        icon="🏆"
        title="Leaderboard"
        subtitle="Ranked by real focused time saved to your report"
        right={<Badge color="#a855f7">{hasToday ? "Your rank: #1" : "No time saved today"}</Badge>}
      />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-7">
          <Card className="p-6 fu-stagger" style={{ "--fu-i": 0 }}>
            <SectionTitle title="Today" subtitle="From live monitoring, persisted every minute" className="mb-5" />
            {!hasToday ? (
              <EmptyState icon="🏆" title="No tracked time today" hint="Start Live Monitoring — your time appears here once it is saved." />
            ) : (
              <div
                className="flex items-center gap-4 p-4 rounded-2xl border"
                style={{ borderColor: "#22c55e40", backgroundColor: "#22c55e08", boxShadow: "0 0 20px rgba(245,158,11,0.10)" }}
              >
                <div className="text-2xl w-9 text-center shrink-0">🥇</div>
                <span
                  className="text-2xl w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#22c55e12", border: "1px solid #22c55e30" }}
                >
                  🧑‍💻
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <p className="font-bold" style={{ color: "#22c55e" }}>You</p>
                    <span className="text-[11px] text-slate-500">🔥 {streak}m live streak</span>
                  </div>
                  <Meter pct={100} color="#22c55e" height={8} glow />
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-lg leading-none" style={{ color: "#22c55e" }}>{formatHM(focusMin)}</p>
                  <p className="text-xs text-slate-600 mt-1">focused</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl border p-3" style={{ borderColor: "#f9731620", backgroundColor: "#f9731608" }}>
                <p className="text-[11px] text-slate-500">Distraction today</p>
                <p className="text-lg font-bold" style={{ color: "#f97316" }}>{formatHM(distMin)}</p>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: "#a855f720", backgroundColor: "#a855f708" }}>
                <p className="text-[11px] text-slate-500">All-time focus</p>
                <p className="text-lg font-bold" style={{ color: "#a855f7" }}>{formatHM(lifetimeMin)}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
          <Card className="p-5 fu-stagger" style={{ "--fu-i": 1 }}>
            <SectionTitle title="This week by day" subtitle="Highest focused time first" className="mb-4" />
            {weekDays.length === 0 ? (
              <EmptyState icon="⏱" title="Nothing tracked yet" />
            ) : (
              <div className="space-y-3.5">
                {weekDays.map((d, i) => {
                  const mins = dayFocusMin(d);
                  const isToday = d.date === today;
                  return (
                    <div key={d.date} className="flex items-center gap-3">
                      <span className="text-sm w-5 text-center shrink-0">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs mb-1.5 gap-2">
                          <span className="truncate" style={{ color: isToday ? "#22c55e" : "#78716c" }}>
                            {weekdayShort(d.date)}{isToday ? " (today)" : ""}
                          </span>
                          <span className="text-slate-600 whitespace-nowrap">{formatHM(mins)}</span>
                        </div>
                        <Meter
                          pct={topFocus > 0 ? (mins / topFocus) * 100 : 0}
                          color={isToday ? "#22c55e" : "#334155"}
                          height={6}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5 fu-stagger" style={{ "--fu-i": 3 }}>
            <SectionTitle title="How ranking works" className="mb-3" />
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <li className="flex gap-2"><span>⏱</span><span>Days are ranked by focused hours and minutes saved in the database.</span></li>
              <li className="flex gap-2"><span>😴</span><span>Distraction is one overall time — not fatigue, anxiety, or boredom separately.</span></li>
              <li className="flex gap-2"><span>🔥</span><span>Longest focused streak saved today: {longestStreak}m.</span></li>
              <li className="flex gap-2"><span>📅</span><span>Refresh keeps the week — totals are loaded from Mongo, not dummy rows.</span></li>
            </ul>
            {week?.insight && (
              <p className="text-xs mt-3 text-slate-700 leading-relaxed">{week.insight}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
