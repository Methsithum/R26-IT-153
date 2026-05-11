import React from "react";
import Card from "../Card";

export default function TabLeaderboard({ TEAM, myRank }) {
  const sortedTeam = [...TEAM].sort((a, b) => b.pts - a.pts);
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 md:col-span-7">
        <Card className="p-6">
          <h3 className="font-semibold text-slate-900 mb-5 flex items-center gap-2">🏆 Team Rankings</h3>
          <div className="space-y-3">
            {sortedTeam.map((m, i) => (
              <div key={m.id} className="flex items-center gap-4 p-4 rounded-2xl border transition-all" style={{ borderColor: m.isMe ? "#22c55e40" : "rgba(0,0,0,0.06)", backgroundColor: m.isMe ? "#22c55e08" : "rgba(0,0,0,0.02)", boxShadow: i === 0 ? "0 0 20px rgba(245,158,11,0.08)" : "none" }}>
                <div className="text-2xl w-8 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-slate-600 font-bold text-lg">{i + 1}</span>}</div>
                <span className="text-3xl">{m.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="font-bold" style={{ color: m.isMe ? "#22c55e" : "#334155" }}>{m.name}{m.isMe ? " (You)" : ""}</p>
                    {m.isMe && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">Me</span>}
                  </div>
                  <div className="h-2 rounded-full bg-slate-300">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(m.pts / sortedTeam[0].pts) * 100}%`, backgroundColor: m.isMe ? "#22c55e" : i === 0 ? "#f59e0b" : "#334155", boxShadow: m.isMe ? "0 0 8px #22c55e60" : i === 0 ? "0 0 8px #f59e0b60" : "none" }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg" style={{ color: m.isMe ? "#22c55e" : "#334155" }}>{m.pts}</p>
                  <p className="text-xs text-slate-600">points</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Team Stats</h3>
          <div className="space-y-3">
            {sortedTeam.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3">
                <span className="text-lg">{m.avatar}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: m.isMe ? "#22c55e" : "#78716c" }}>{m.name}</span>
                    <span className="text-slate-600">{m.focusToday}m today</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-300">
                    <div className="h-full rounded-full" style={{ width: `${(m.focusToday / sortedTeam.reduce((a, b) => a.focusToday > b.focusToday ? a : b).focusToday) * 100}%`, backgroundColor: m.isMe ? "#22c55e" : "#334155" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {myRank > 1 && (
          <Card className="p-5" style={{ borderColor: "#22c55e20", background: "#22c55e05" }}>
            <h3 className="font-semibold text-green-400 mb-2">💪 Motivation</h3>
            <p className="text-sm text-slate-700">You need <span className="text-green-600 font-bold">{sortedTeam[myRank - 2].pts - sortedTeam[myRank - 1].pts} more points</span> to reach #{myRank - 1}! Focus for <span className="text-green-600 font-bold">{Math.ceil((sortedTeam[myRank - 2].pts - sortedTeam[myRank - 1].pts) / 10)} more minutes</span> to climb the leaderboard.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
