import React, { useEffect, useState } from "react";
import { INTERVENTIONS } from "./focusData";

export default function IntModal({ open, onClose, type, onComplete }) {
  const [done, setDone] = useState([]);

  const cfg = INTERVENTIONS[type] || INTERVENTIONS.focus;
  const finished = done.length === cfg.steps.length;

  useEffect(() => {
    if (open) setDone([]);
  }, [open, type]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.35)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-md rounded-3xl border p-6 shadow-2xl" style={{ backgroundColor: "rgba(255,255,255,0.96)", borderColor: `${cfg.color}30` }}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{cfg.emoji}</span>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest">{type} Detected</p>
              <p className="text-xl font-bold text-slate-900">{cfg.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 text-xl">✕</button>
        </div>

        <p className="text-slate-700 text-sm mb-4">{cfg.msg}</p>

        <div className="space-y-2 mb-4">
          {cfg.steps.map((step, index) => {
            const complete = done.includes(index);
            return (
              <button
                key={step}
                onClick={() => setDone((current) => (current.includes(index) ? current.filter((item) => item !== index) : [...current, index]))}
                className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
                style={{ borderColor: complete ? cfg.color : "rgba(148,163,184,0.22)", backgroundColor: complete ? `${cfg.color}12` : "rgba(255,255,255,0.7)" }}
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: complete ? cfg.color : "transparent", border: `2px solid ${complete ? cfg.color : "rgba(148,163,184,0.4)"}`, color: complete ? "#fff" : "#64748b" }}>
                  {complete ? "✓" : index + 1}
                </div>
                <span className={`text-sm ${complete ? "text-slate-900" : "text-slate-600"}`}>{step}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50" style={{ borderColor: "rgba(148,163,184,0.24)" }}>
            Close
          </button>
          <button onClick={() => onComplete && onComplete(type)} disabled={!finished} className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: cfg.color }}>
            {finished ? `✓ Claim +${cfg.reward} pts` : "Complete steps to claim reward"}
          </button>
        </div>
      </div>
    </div>
  );
}
