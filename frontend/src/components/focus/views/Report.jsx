import React, { useState } from "react";
import Card from "../Card";
import { WEEKLY, REPORT_TYPES } from "../focusData";

export default function TabReport({ focusMin, points, dist, myRank }) {
  const [selectedDate, setSelectedDate] = useState(WEEKLY[2].date);
  const selectedDay = WEEKLY.find(d => d.date === selectedDate) || WEEKLY[2];

  const dailySummary = [
    { label: "Focus", value: focusMin, unit: "min", color: "#22c55e", pct: Math.round((focusMin / 120) * 100) },
    { label: "Fatigue", value: dist.Fatigue, unit: "min", color: "#f97316", pct: Math.round((dist.Fatigue / Object.values(dist).reduce((a, b) => a + b, 0)) * 100) },
    { label: "Anxiety", value: dist.Anxiety, unit: "min", color: "#ef4444", pct: Math.round((dist.Anxiety / Object.values(dist).reduce((a, b) => a + b, 0)) * 100) },
    { label: "Boredom", value: dist.Boredom, unit: "min", color: "#3b82f6", pct: Math.round((dist.Boredom / Object.values(dist).reduce((a, b) => a + b, 0)) * 100) },
  ];

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[{ label: "Daily Focus", value: `${focusMin}m`, icon: "⏱", color: "#22c55e" }, { label: "Weekly Focus", value: "8.2h", icon: "📊", color: "#3b82f6" }, { label: "Best Day", value: "Wed", icon: "🏆", color: "#f59e0b" }, { label: "Focus Score", value: "74%", icon: "🎯", color: "#a855f7" }].map(s => (
            <Card key={s.label} className="p-4 text-center">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-slate-600">{s.label}</p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-slate-900">Daily Summary</h3>
                <p className="text-xs text-slate-600">Today's focus and distraction split</p>
              </div>
              <div className="text-xs px-2.5 py-1 rounded-full border border-slate-300 text-slate-600">{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
            </div>
            <div className="space-y-3">
              {dailySummary.map(item => (
                <div key={item.label} className="rounded-xl border border-white/5 p-3" style={{ backgroundColor: `${item.color}08`, borderColor: `${item.color}20` }}>
                  <div className="flex justify-between text-sm mb-2">
                    <span style={{ color: item.color }}>{item.label}</span>
                    <span className="font-bold" style={{ color: item.color }}>{item.value}{item.unit}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-300 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(item.pct, 100)}%`, backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}55` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-slate-900">Weekly Summary</h3>
                <p className="text-xs text-slate-600">Pick a date to see the day details</p>
              </div>
              <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none">
                {WEEKLY.map(d => (<option key={d.date} value={d.date}>{d.date} - {d.day}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-7 gap-2 items-end h-44 mb-5">
              {WEEKLY.map(d => {
                const active = d.date === selectedDate;
                return (
                  <button key={d.date} onClick={() => setSelectedDate(d.date)} className="flex h-full flex-col items-center justify-end gap-1 text-left">
                    <span className="text-[10px] text-slate-600">{d.focus}%</span>
                    <div className="w-full rounded-t-lg transition-all duration-300" style={{ height: `${(d.focus / 100) * 140}px`, background: active ? "linear-gradient(180deg,#a855f7,#7c3aed)" : "linear-gradient(180deg,#22c55e,#16a34a)", boxShadow: active ? "0 0 14px #a855f744" : "0 0 12px #22c55e30", border: active ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.05)" }} />
                    <span className="text-[10px] text-slate-600">{d.day}</span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-2xl border border-slate-200 p-4" style={{ background: `linear-gradient(135deg,${selectedDay.focus >= 85 ? "#22c55e" : "#3b82f6"}08,rgba(255,255,255,0.5))` }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selectedDay.date}</p>
                  <p className="text-xs text-slate-600">{selectedDay.day}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.05)", color: selectedDay.focus >= 85 ? "#22c55e" : "#3b82f6" }}>{selectedDay.detail.note}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {REPORT_TYPES.map(type => {
                  const value = selectedDay.detail[type.key];
                  return (
                    <div key={type.key} className="rounded-xl border p-3" style={{ backgroundColor: `${type.color}08`, borderColor: `${type.color}25` }}>
                      <p className="text-[11px] uppercase tracking-widest" style={{ color: type.color }}>{type.label}</p>
                      <p className="mt-1 text-2xl font-bold" style={{ color: type.color }}>{value}</p>
                      <p className="text-[11px] text-slate-600">minutes</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Daily Report</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: "Focus Time", value: `${focusMin} min`, color: "#22c55e" },
                { label: "Total Points", value: `${points} pts`, color: "#f59e0b" },
                { label: "Fatigue Events", value: `${dist.Fatigue} min`, color: "#f97316" },
                { label: "Anxiety Events", value: `${dist.Anxiety} min`, color: "#ef4444" },
                { label: "Boredom Events", value: `${dist.Boredom} min`, color: "#3b82f6" },
                { label: "Team Rank", value: `#${myRank}`, color: "#a855f7" },
              ].map(r => (
                <div key={r.label} className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-slate-600">{r.label}</span>
                  <span className="font-bold" style={{ color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-slate-900 mb-4">💡 Personalized Insights</h3>
            <div className="space-y-3">
              {[{ icon: "📉", text: "Friday had most distractions due to fatigue. You studied 4 hours continuously. Try adding short breaks next Friday.", color: "#f97316" }, { icon: "🌟", text: "Wednesday was your best focus day this week with 91% focus rate!", color: "#22c55e" }, { icon: "🎯", text: "Your Boredom episodes peak after 45-min study blocks. Consider switching topics then.", color: "#3b82f6" }].map((ins, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl border" style={{ borderColor: `${ins.color}25`, backgroundColor: `${ins.color}08` }}>
                  <span className="text-xl shrink-0">{ins.icon}</span>
                  <p className="text-xs text-slate-700 leading-relaxed">{ins.text}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
