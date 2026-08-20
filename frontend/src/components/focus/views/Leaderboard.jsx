import React from "react";
import Card from "../Card";
import { PageHeader, SectionTitle, Meter, Badge, EmptyState } from "../ui";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function TabLeaderboard({ TEAM, myRank }) {
  const sortedTeam = [...TEAM].sort((a, b) => b.pts - a.pts);
  // Before any points are scored the leader sits at 0 — dividing by it would put
  // NaN into every bar width, so the rails just render empty instead.
  const topPts = sortedTeam[0]?.pts || 0;
  const topFocus = sortedTeam.reduce((max, m) => Math.max(max, m.focusToday || 0), 0);

  return (
    <div className="fu-view">
      <PageHeader
        icon="🏆"
        title="Leaderboard"
        subtitle="Ranked by points earned in the current session"
        right={<Badge color="#a855f7">Your rank: #{myRank}</Badge>}
      />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-7">
          <Card className="p-6 fu-stagger" style={{ "--fu-i": 0 }}>
            <SectionTitle title="🏆 Team Rankings" subtitle="Live standings" className="mb-5" />
            {sortedTeam.length === 0 ? (
              <EmptyState icon="🏆" title="No one on the board yet" hint="Start a session to appear in the rankings." />
            ) : (
              <div className="space-y-3">
                {sortedTeam.map((m, i) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-4 p-4 rounded-2xl border transition-all fu-lift"
                    style={{
                      borderColor: m.isMe ? "#22c55e40" : "rgba(0,0,0,0.06)",
                      backgroundColor: m.isMe ? "#22c55e08" : "rgba(0,0,0,0.02)",
                      boxShadow: i === 0 ? "0 0 20px rgba(245,158,11,0.10)" : "none",
                    }}
                  >
                    <div className="text-2xl w-9 text-center shrink-0">
                      {MEDALS[i] || <span className="text-slate-500 font-bold text-lg">{i + 1}</span>}
                    </div>
                    <span
                      className="text-2xl w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: m.isMe ? "#22c55e12" : "rgba(0,0,0,0.03)",
                        border: `1px solid ${m.isMe ? "#22c55e30" : "rgba(0,0,0,0.06)"}`,
                      }}
                    >
                      {m.avatar}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <p className="font-bold" style={{ color: m.isMe ? "#22c55e" : "#334155" }}>{m.name}</p>
                        {m.isMe && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>
                            You
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500">🔥 {m.streak}m streak</span>
                      </div>
                      <Meter
                        pct={topPts > 0 ? (m.pts / topPts) * 100 : 0}
                        color={m.isMe ? "#22c55e" : i === 0 ? "#f59e0b" : "#334155"}
                        height={8}
                        glow
                      />
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-lg leading-none" style={{ color: m.isMe ? "#22c55e" : "#334155" }}>
                        {m.pts.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">points</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
          <Card className="p-5 fu-stagger" style={{ "--fu-i": 1 }}>
            <SectionTitle title="Focus Time Today" subtitle="Minutes focused per member" className="mb-4" />
            {sortedTeam.length === 0 ? (
              <EmptyState icon="⏱" title="Nothing tracked yet" />
            ) : (
              <div className="space-y-3.5">
                {sortedTeam.map((m) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <span className="text-lg shrink-0">{m.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1.5 gap-2">
                        <span className="truncate" style={{ color: m.isMe ? "#22c55e" : "#78716c" }}>{m.name}</span>
                        <span className="text-slate-600 whitespace-nowrap">{m.focusToday}m today</span>
                      </div>
                      <Meter
                        pct={topFocus > 0 ? (m.focusToday / topFocus) * 100 : 0}
                        color={m.isMe ? "#22c55e" : "#334155"}
                        height={6}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {myRank > 1 && sortedTeam[myRank - 2] && (
            <Card className="p-5 fu-stagger" style={{ "--fu-i": 2, borderColor: "#22c55e20", background: "#22c55e05" }}>
              <SectionTitle title="💪 Motivation" className="mb-2" />
              <p className="text-sm text-slate-700 leading-relaxed">
                You need{" "}
                <span className="font-bold" style={{ color: "#22c55e" }}>
                  {sortedTeam[myRank - 2].pts - sortedTeam[myRank - 1].pts} more points
                </span>{" "}
                to reach #{myRank - 1}! Focus for{" "}
                <span className="font-bold" style={{ color: "#22c55e" }}>
                  {Math.ceil((sortedTeam[myRank - 2].pts - sortedTeam[myRank - 1].pts) / 10)} more minutes
                </span>{" "}
                to climb the leaderboard.
              </p>
            </Card>
          )}

          <Card className="p-5 fu-stagger" style={{ "--fu-i": 3 }}>
            <SectionTitle title="How ranking works" className="mb-3" />
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <li className="flex gap-2"><span>✦</span><span>Every focused minute is worth 10 points.</span></li>
              <li className="flex gap-2"><span>⚡</span><span>A 25-minute unbroken sprint adds a 50-point bonus.</span></li>
              <li className="flex gap-2"><span>🎯</span><span>Hitting the daily goal adds 100 points.</span></li>
              <li className="flex gap-2"><span>👤</span><span>Standings cover the current session only — nothing is carried over.</span></li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
