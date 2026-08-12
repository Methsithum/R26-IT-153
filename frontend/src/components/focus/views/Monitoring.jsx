import React, { useEffect, useRef } from "react";
import Card from "../Card";
import { CLASSES, STATE_CFG } from "../focusData";

export default function TabMonitoring({ state, handleStateSelect, camera, sessionOn, setSessionOn, dist, points, focusMin }) {
  const displayVideoRef = useRef(null);
  const { camStatus, stream, probs, confidence, faceDetected, predictError } = camera;

  // Same MediaStream as the hidden capture <video> in FocusApp — a stream can be
  // attached to multiple <video> elements at once, each renders independently.
  useEffect(() => {
    if (displayVideoRef.current) displayVideoRef.current.srcObject = stream || null;
  }, [stream]);

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 md:col-span-7">
        <Card className="p-5 mb-4">
          <div className="rounded-2xl overflow-hidden relative" style={{ paddingBottom: "56.25%", background: "#0f172a", border: "1px solid rgba(0,0,0,0.06)" }}>
            <video ref={displayVideoRef} autoPlay playsInline muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ display: camStatus === "live" ? "block" : "none", transform: "scaleX(-1)" }} />

            {camStatus !== "live" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <span className="text-6xl opacity-30">📷</span>
                <p className="text-slate-300 text-sm">
                  {camStatus === "starting" && "Starting camera..."}
                  {camStatus === "idle" && "Session paused — resume to start monitoring"}
                  {camStatus === "denied" && "Camera access denied"}
                  {camStatus === "unsupported" && "Camera not supported in this browser"}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className={`w-2 h-2 rounded-full ${camStatus === "starting" ? "bg-yellow-400 animate-pulse" : "bg-slate-500"}`} />
                  <span className="text-xs text-slate-400">{camStatus}</span>
                </div>
              </div>
            )}

            {camStatus === "live" && (
              <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: "rgba(15,23,42,0.7)", color: faceDetected ? "#22c55e" : "#f59e0b" }}>
                <div className={`w-2 h-2 rounded-full ${faceDetected ? "bg-green-400" : "bg-amber-400"} animate-pulse`} />
                {faceDetected ? "Face detected" : "No face"}
              </div>
            )}

            {predictError && (
              <div className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-lg text-xs text-white" style={{ backgroundColor: "rgba(239,68,68,0.85)" }}>
                {predictError} — is the backend running?
              </div>
            )}

            {["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"].map((pos, i) => (
              <div key={i} className={`absolute ${pos} w-6 h-6`} style={{ borderTop: i < 2 ? "2px solid #22c55e60" : "none", borderBottom: i >= 2 ? "2px solid #22c55e60" : "none", borderLeft: [0, 2].includes(i) ? "2px solid #22c55e60" : "none", borderRight: [1, 3].includes(i) ? "2px solid #22c55e60" : "none" }} />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4">State Confidence</h3>
          <div className="space-y-4">
            {CLASSES.map(cls => {
              const active = state === cls;
              return (
                <div key={cls}>
                  <div className="flex justify-between mb-1.5">
                    <span className="flex items-center gap-2 text-sm" style={{ color: active ? STATE_CFG[cls].color : "#78716c", fontWeight: active ? 700 : 400 }}>{STATE_CFG[cls].icon} {cls}</span>
                    <span className="text-sm font-bold" style={{ color: STATE_CFG[cls].color }}>{Math.round((probs[cls] || 0) * 100)}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-300">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(probs[cls] || 0) * 100}%`, backgroundColor: STATE_CFG[cls].color, boxShadow: active ? `0 0 12px ${STATE_CFG[cls].color}70` : "none" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
        <Card className="p-6 text-center transition-all duration-700" style={{ background: `linear-gradient(135deg,${STATE_CFG[state].color}15,rgba(255,255,255,0.5))`, borderColor: STATE_CFG[state].border, boxShadow: `0 0 40px ${STATE_CFG[state].color}15` }}>
          <div className="text-6xl mb-3">{STATE_CFG[state].icon}</div>
          <p className="text-3xl font-bold mb-1" style={{ color: STATE_CFG[state].color }}>{STATE_CFG[state].label}</p>
          <p className="text-xs text-slate-600 uppercase tracking-widest">Detected State</p>
          <div className="mt-4 px-4 py-2 rounded-xl inline-block text-xs font-semibold" style={{ backgroundColor: `${STATE_CFG[state].color}15`, color: STATE_CFG[state].color, border: `1px solid ${STATE_CFG[state].color}30` }}>Confidence: {Math.round(confidence * 100)}%</div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-widest">Manual Override</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(STATE_CFG).map(([s, c]) => (
              <button key={s} onClick={() => handleStateSelect(s)} className="py-3 px-4 rounded-xl text-sm font-semibold border transition-all" style={{ borderColor: state === s ? c.color : "rgba(0,0,0,0.08)", backgroundColor: state === s ? `${c.color}18` : "rgba(0,0,0,0.02)", color: state === s ? c.color : "#78716c", boxShadow: state === s ? `0 0 15px ${c.color}25` : "none" }}>{c.icon} {s}</button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">Overrides live detection for a few seconds.</p>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Session Info</h3>
          <div className="space-y-2 text-sm">
            {[{ label: "Session Status", value: sessionOn ? "Active" : "Paused", color: sessionOn ? "#22c55e" : "#94a3b8" }, { label: "Focus Today", value: `${focusMin} min`, color: "#22c55e" }, { label: "Distractions", value: `${Object.values(dist).reduce((a, b) => a + b, 0).toFixed(1)} min`, color: "#f97316" }, { label: "Points Earned", value: `${points}`, color: "#f59e0b" }].map(r => (
              <div key={r.label} className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-slate-600">{r.label}</span>
                <span className="font-semibold" style={{ color: r.color }}>{r.value}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setSessionOn(s => !s)} className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm border transition-all" style={{ backgroundColor: sessionOn ? "#ef444415" : "#22c55e15", borderColor: sessionOn ? "#ef444440" : "#22c55e40", color: sessionOn ? "#ef4444" : "#22c55e" }}>{sessionOn ? "⏸ Pause Session" : "▶ Resume Session"}</button>
        </Card>
      </div>
    </div>
  );
}
