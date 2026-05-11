import React from "react";
import Card from "../Card";
import TreeSVG from "../TreeSVG";
import { STATE_CFG, LEVEL_DATA } from "../focusData";

export default function TabTree({ state, points, streak, focusMin, LEVEL_DATA: LD = LEVEL_DATA }) {
  const cfg = STATE_CFG[state] || STATE_CFG.Focused;
  const lv = LD.filter((l) => points >= l.min).length - 1;

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
        <Card className="p-8 flex flex-col items-center transition-all duration-700" style={{ background: `linear-gradient(180deg,${cfg.color}08,rgba(255,255,255,0.5))`, borderColor: cfg.border }}>
          <TreeSVG state={state} points={points} size={220} />
          <div className="text-center mt-4">
            <p className="text-2xl font-bold text-slate-900 mb-1">{LD[lv].icon} {LD[lv].name}</p>
            <p className="text-sm text-slate-600">Your Focus Tree</p>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Level Progress</h3>
          <div className="space-y-3">
            {LD.map((lvl, i) => {
              const active = i === lv;
              const passed = i < lv;
              return (
                <div key={lvl.name} className="flex items-center gap-3">
                  <span className="text-xl w-8 text-center">{passed ? "✅" : active ? lvl.icon : "🔒"}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: active ? "#f59e0b" : passed ? "#22c55e" : "#475569", fontWeight: active ? 700 : 400 }}>{lvl.name}</span>
                      <span className="text-slate-600">{lvl.min}–{lvl.max} pts</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-300">
                      <div className="h-full rounded-full transition-all" style={{ width: passed ? "100%" : active ? `${(points - LD[lv].min) / (LD[lv + 1] ? LD[lv + 1].min - LD[lv].min : 1) * 100}%` : "0%", background: passed ? "#22c55e" : active ? "linear-gradient(90deg,#22c55e,#f59e0b)" : "transparent" }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="col-span-12 md:col-span-7 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {[{ label: "Total Points", value: points, icon: "✦", color: "#f59e0b", unit: "pts" }, { label: "Focus Today", value: focusMin, icon: "⏱", color: "#22c55e", unit: "min" }, { label: "Streak", value: streak, icon: "🔥", color: "#f97316", unit: "min" }, { label: "Trees Planted", value: lv + 1, icon: "🌱", color: "#22c55e", unit: "" }].map(s => (
            <Card key={s.label} className="p-5 text-center">
              <p className="text-3xl mb-2">{s.icon}</p>
              <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}<span className="text-lg ml-1">{s.unit}</span></p>
              <p className="text-xs text-slate-600 mt-1">{s.label}</p>
            </Card>
          ))}
        </div>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Tree State Guide</h3>
          <div className="space-y-3">
            {Object.entries(STATE_CFG).map(([s, c]) => (
              <div key={s} className="flex items-start gap-3 p-3 rounded-xl border transition-all" style={{ borderColor: state === s ? c.color : "rgba(0,0,0,0.05)", backgroundColor: state === s ? `${c.color}10` : "transparent" }}>
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: c.color }}>{s}</p>
                  <p className="text-xs text-slate-600">{s === "Focused" ? "Tree grows and sparkles with energy!" : s === "Fatigue" ? "Tree droops and loses vibrancy..." : s === "Anxiety" ? "Tree shakes and trembles nervously..." : "Tree becomes sparse and still..."}</p>
                </div>
                {state === s && <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${c.color}20`, color: c.color }}>Now</span>}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Points Guide</h3>
          <div className="space-y-2 text-sm">
            {[{ action: "Focus 1 minute", pts: "+10", color: "#22c55e" }, { action: "25-min continuous focus", pts: "+50 bonus", color: "#f59e0b" }, { action: "Complete daily goal", pts: "+100 bonus", color: "#a855f7" }, { action: "Complete Break Challenge", pts: "+20", color: "#f97316" }, { action: "Complete Calm Quest", pts: "+15", color: "#ef4444" }, { action: "Complete Bonus Content", pts: "+25", color: "#3b82f6" }].map(p => (
              <div key={p.action} className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-slate-700">{p.action}</span>
                <span className="font-bold" style={{ color: p.color }}>{p.pts}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
