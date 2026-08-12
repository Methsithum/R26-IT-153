import React from "react";
import Card from "../Card";
import TreeSVG from "../TreeSVG";
import { STATE_CFG, LEVEL_DATA } from "../focusData";

export default function TabDashboard({ state, points, focusMin, streak, TEAM, ACHIEVEMENTS_LIST, LEVEL_DATA: LD = LEVEL_DATA, todayGoal, dist, myRank }) {
  const cfg = STATE_CFG[state] || STATE_CFG.Focused;
  const lv = LD.filter((l) => points >= l.min).length - 1;
  const sortedTeam = [...TEAM].sort((a, b) => b.pts - a.pts);

  const goalPct = Math.min((focusMin / todayGoal) * 100, 100);
  const lvPts = [0, 500, 1500, 3000];
  const nextPts = lvPts[lv + 1] || 3000;
  const lvPct = lv < 3 ? ((points - lvPts[lv]) / (nextPts - lvPts[lv])) * 100 : 100;

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
        <Card className="p-5 transition-all duration-700" style={{ background: `linear-gradient(135deg,${cfg.color}12,rgba(255,255,255,0.5))`, borderColor: cfg.border, boxShadow: `0 0 30px ${cfg.color}12` }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">{cfg.icon}</span>
            <div>
              <p className="text-xs text-slate-600 uppercase tracking-widest">Current State</p>
              <p className="text-2xl font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
            </div>
          </div>
          <div className="flex gap-1">
            {Object.entries(STATE_CFG).map(([s, c]) => (
              <div key={s} className="flex-1 h-1.5 rounded-full transition-all duration-500" style={{ backgroundColor: state === s ? c.color : `${c.color}25` }} />
            ))}
          </div>
        </Card>

        <Card className="p-5 flex justify-center">
          <div>
            <TreeSVG state={state} points={points} size={160} />
            <div className="text-center mt-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full border" style={{ color: LD[lv].icon === "✨" ? "#f59e0b" : cfg.color, borderColor: `${cfg.color}40`, backgroundColor: `${cfg.color}10` }}>{LD[lv].icon} {LD[lv].name}</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-600">Level {lv + 1} Progress</span>
            <span className="text-yellow-400">{points}/{nextPts}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${lvPct}%`, background: "linear-gradient(90deg,#22c55e,#f59e0b)", boxShadow: "0 0 8px #22c55e50" }} />
          </div>
          <p className="text-xs text-slate-600 mt-1">{lv < 3 ? `${nextPts - points} pts to ${LD[lv + 1].name}` : "Max Level!"}</p>
        </Card>
      </div>

      <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          {[{ label: "Focus Time", value: `${focusMin}m`, icon: "⏱", color: "#22c55e" }, { label: "Streak", value: `${streak}m`, icon: "🔥", color: "#f97316" }, { label: "Rank", value: `#${myRank}`, icon: "🏆", color: "#a855f7" }].map(s => (
            <Card key={s.label} className="p-4 text-center">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-slate-600">{s.label}</p>
            </Card>
          ))}
        </div>

        <Card className="p-5">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-semibold text-slate-900">Daily Goal</h3>
              <p className="text-xs text-slate-600">{focusMin} / {todayGoal} min</p>
            </div>
            <span className="text-2xl font-bold text-green-400">{Math.round(goalPct)}%</span>
          </div>
          <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full rounded-full relative transition-all duration-700" style={{ width: `${goalPct}%`, background: "linear-gradient(90deg,#22c55e,#86efac)", boxShadow: "0 0 10px #22c55e40" }}>
              <div className="absolute inset-0 bg-white/10 animate-pulse" />
            </div>
          </div>
          {goalPct >= 100 && <p className="text-xs text-green-400 mt-2">🎉 Goal achieved! +100 bonus pts</p>}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Today's Distraction Breakdown</h3>
          <div className="space-y-3">
            {[{ k: "Fatigue", icon: "😴", c: "#f97316" }, { k: "Anxiety", icon: "😰", c: "#ef4444" }, { k: "Boredom", icon: "😑", c: "#3b82f6" }].map(d => {
              const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
              const val = dist[d.k] || 0;
              const pct = Math.round((val / total) * 100);
              return (
                <div key={d.k}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700">{d.icon} {d.k}</span>
                    <span style={{ color: d.c }}>{val}m ({pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-300">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: d.c, boxShadow: `0 0 6px ${d.c}50` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-slate-900 mb-3 text-sm">Recent Achievements</h3>
          <div className="flex gap-2 flex-wrap">
            {ACHIEVEMENTS_LIST.filter(a => a.earned).slice(0, 4).map(a => (
              <div key={a.id} title={a.desc} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold" style={{ borderColor: "#f59e0b35", backgroundColor: "#f59e0b08", color: "#f59e0b" }}>
                {a.icon} {a.name}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="col-span-12 md:col-span-3">
        <Card className="p-5 h-full">
          <h3 className="font-semibold text-slate-900 mb-4">🏆 Team</h3>
          <div className="space-y-2">
            {sortedTeam.map((m, i) => (
              <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-xl border transition-all" style={{ borderColor: m.isMe ? "#22c55e30" : "rgba(0,0,0,0.05)", backgroundColor: m.isMe ? "#22c55e08" : "transparent" }}>
                <span className="text-sm w-5 text-center font-bold" style={{ color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : "#78716c" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}</span>
                <span className="text-lg">{m.avatar}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: m.isMe ? "#22c55e" : "#334155" }}>{m.name}{m.isMe ? " (You)" : ""}</p>
                  <div className="h-1 rounded-full bg-slate-300 mt-0.5">
                    <div className="h-full rounded-full" style={{ width: `${(m.pts / sortedTeam[0].pts) * 100}%`, backgroundColor: m.isMe ? "#22c55e" : "#334155" }} />
                  </div>
                </div>
                <span className="text-xs text-slate-600 font-bold">{m.pts}</span>
              </div>
            ))}
          </div>
          {myRank > 1 && (
            <div className="mt-3 p-2.5 rounded-xl border border-green-500/15 bg-green-500/5">
              <p className="text-xs text-green-400">💪 {sortedTeam[myRank - 2].pts - sortedTeam[myRank - 1].pts} pts to #{myRank - 1}!</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
