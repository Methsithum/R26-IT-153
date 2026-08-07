import React from "react";
import { TABS } from "./focusData";

export default function FocusHeader({ tab, setTab, cfg, points, sessionOn, setSessionOn, setShowCheckIn }) {
  return (
    <div className="sticky top-0 z-40 border-b border-slate-200" style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(16px)" }}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="text-xl">🌱</span>
            <span className="font-bold text-slate-900">FocusForest</span>
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
              {cfg.icon} {cfg.label}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSessionOn((s) => !s)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
              style={{ backgroundColor: sessionOn ? "#22c55e20" : "rgba(0,0,0,0.04)", borderColor: sessionOn ? "#22c55e" : "rgba(0,0,0,0.1)", color: sessionOn ? "#22c55e" : "#64748b" }}>
              {sessionOn ? "● Active" : "○ Paused"}
            </button>
            <div className="px-3 py-1.5 rounded-lg text-xs font-bold border border-yellow-500/25" style={{ backgroundColor: "#f59e0b10", color: "#f59e0b" }}>
              ✦ {points.toLocaleString()}
            </div>
            <button onClick={() => setShowCheckIn(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 transition-all">
              Check-in
            </button>
          </div>
        </div>

        <div className="flex gap-1 pb-0 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all"
              style={{ borderBottomColor: tab === t.id ? cfg.color : "transparent", color: tab === t.id ? cfg.color : "#94a3b8" }}>
              <span className="text-base">{t.icon}</span>
              <span className="hidden md:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
