import React from "react";
import Card from "../Card";
import { ACHIEVEMENTS_LIST } from "../focusData";

export default function TabAchievements() {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12">
        <div className="flex gap-4 mb-4">
          {[{ label: "Earned", value: ACHIEVEMENTS_LIST.filter(a => a.earned).length, color: "#22c55e" }, { label: "Locked", value: ACHIEVEMENTS_LIST.filter(a => !a.earned).length, color: "#64748b" }, { label: "Total Pts", value: ACHIEVEMENTS_LIST.filter(a => a.earned).reduce((s, a) => s + a.pts, 0), color: "#f59e0b" }].map(s => (
            <Card key={s.label} className="flex-1 p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-slate-600">{s.label}</p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ACHIEVEMENTS_LIST.map(a => (
            <Card key={a.id} className="p-5 transition-all" style={{ borderColor: a.earned ? "#f59e0b30" : "rgba(0,0,0,0.05)", backgroundColor: a.earned ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.3)", opacity: a.earned ? 1 : 0.55 }}>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ backgroundColor: a.earned ? "#f59e0b15" : "rgba(0,0,0,0.04)", border: `1px solid ${a.earned ? "#f59e0b30" : "rgba(0,0,0,0.06)"}` }}>{a.earned ? a.icon : "🔒"}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm mb-0.5" style={{ color: a.earned ? "#f59e0b" : "#64748b" }}>{a.name}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{a.desc}</p>
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: a.earned ? "#f59e0b15" : "rgba(0,0,0,0.04)", color: a.earned ? "#f59e0b" : "#78716c" }}>✦ {a.pts} pts</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
