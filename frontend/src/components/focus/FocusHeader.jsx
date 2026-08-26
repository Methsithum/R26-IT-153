import React from "react";
import { TABS } from "./focusData";
import { formatHM } from "../../lib/focusTime";

export default function FocusHeader({
  tab,
  setTab,
  cfg,
  focusMin,
  sessionStatus = "active",
  sessionOn,
  pauseSession,
  resumeSession,
  startSession,
  setShowCheckIn,
}) {
  const statusLabel = sessionStatus === "ended" ? "Ended" : sessionOn ? "Active" : "Paused";
  const statusColor = sessionStatus === "ended" ? "#64748b" : sessionOn ? "#22c55e" : "#f59e0b";
  return (
    <div
      className="sticky top-0 z-40 border-b border-slate-200"
      style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)" }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: "#22c55e12", border: "1px solid #22c55e30" }}
            >
              🌱
            </span>
            <span className="font-bold text-slate-900 tracking-tight">FocusForest</span>
            <div
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-500"
              style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: cfg.color }} />
              {cfg.icon} {cfg.label}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                if (sessionStatus === "ended") startSession();
                else if (sessionOn) pauseSession();
                else resumeSession();
              }}
              title={
                sessionStatus === "ended"
                  ? "Start a new session"
                  : sessionOn
                    ? "Pause the session"
                    : "Resume the session"
              }
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
              style={{
                backgroundColor: sessionOn ? "#22c55e15" : "rgba(0,0,0,0.04)",
                borderColor: `${statusColor}50`,
                color: statusColor,
              }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${sessionOn ? "animate-pulse" : ""}`}
                style={{ backgroundColor: statusColor }}
              />
              {statusLabel}
            </button>

            <div
              className="px-3 py-1.5 rounded-lg text-xs font-bold border"
              style={{ backgroundColor: "#f59e0b10", color: "#f59e0b", borderColor: "#f59e0b40" }}
            >
              ⏱ {formatHM(focusMin, { allowSeconds: true })}
            </div>

            <button
              onClick={() => sessionOn && setShowCheckIn(true)}
              disabled={!sessionOn}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 hover:bg-white/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Check-in
            </button>
          </div>
        </div>

        {/* Pill tabs: the active tab carries the live state color so the chrome
            tracks the same signal as the header chip. */}
        <div className="flex gap-1 pb-2 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? "page" : undefined}
                title={t.label}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap border transition-all"
                style={{
                  borderColor: active ? `${cfg.color}45` : "transparent",
                  backgroundColor: active ? `${cfg.color}12` : "transparent",
                  color: active ? cfg.color : "#94a3b8",
                  boxShadow: active ? `0 0 14px ${cfg.color}18` : "none",
                }}
              >
                <span className="text-base leading-none">{t.icon}</span>
                <span className="hidden md:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
