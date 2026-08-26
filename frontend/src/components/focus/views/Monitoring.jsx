import React, { useEffect, useRef } from "react";
import Card from "../Card";
import { CLASSES, STATE_CFG } from "../focusData";
import { PageHeader, SectionTitle, Meter, Badge, DataRow } from "../ui";
import { formatHM } from "../../../lib/focusTime";

export default function TabMonitoring({
  state,
  handleStateSelect,
  camera,
  sessionStatus = "active",
  sessionOn,
  pauseSession,
  resumeSession,
  startSession,
  endSession,
  distMin,
  focusMin,
}) {
  const displayVideoRef = useRef(null);
  const { camStatus, stream, probs, confidence, faceDetected, predictError } = camera;

  // Read the headline number off the same probs map that draws the bars, keyed by
  // the state actually on screen. That keeps "Detected State" and the highlighted
  // "State Confidence" bar identical by construction -- including after a manual
  // override, where `state` is the user's pick and `confidence` is still the model's.
  const displayConfidence = probs[state] ?? confidence;

  // Head turned away => the frontal Haar cascade finds nothing => no prediction runs
  // at all, and `state` still holds the last reading. This card claims "Detected
  // State", so while nothing is detected it has to say so instead of that stale value.
  const showingNoFace = sessionOn && camStatus === "live" && !faceDetected;
  const shownCfg = showingNoFace ? STATE_CFG.NoFace : STATE_CFG[state];
  const statusMeta = sessionStatus === "ended"
    ? { label: "Ended", color: "#64748b", badge: "○ Session ended" }
    : sessionOn
      ? { label: "Active", color: "#22c55e", badge: "● Session active" }
      : { label: "Paused", color: "#f59e0b", badge: "○ Session paused" };

  // Same MediaStream as the hidden capture <video> in FocusApp — a stream can be
  // attached to multiple <video> elements at once, each renders independently.
  useEffect(() => {
    if (displayVideoRef.current) displayVideoRef.current.srcObject = stream || null;
  }, [stream]);

  return (
    <div className="fu-view">
      <PageHeader
        icon="📷"
        title="Live Monitoring"
        subtitle={
          sessionStatus === "ended"
            ? "Session ended — start a new one to keep tracking"
            : sessionOn
              ? "Your webcam feed is analysed locally by the backend model, frame by frame"
              : "Paused — resume to continue from the same focus and distraction totals"
        }
        right={
          <Badge color={statusMeta.color}>
            {statusMeta.badge}
          </Badge>
        }
      />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-7 flex flex-col gap-4">
          <Card className="p-5 fu-stagger" style={{ "--fu-i": 0 }}>
            <div
              className="rounded-2xl overflow-hidden relative"
              style={{ paddingBottom: "56.25%", background: "#0f172a", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <video
                ref={displayVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ display: camStatus === "live" ? "block" : "none", transform: "scaleX(-1)" }}
              />

              {camStatus !== "live" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <span className="text-6xl opacity-30">📷</span>
                  <p className="text-slate-300 text-sm">
                    {camStatus === "starting" && "Starting camera..."}
                    {camStatus === "idle" && (sessionStatus === "ended" ? "Session ended — start to monitor again" : "Session paused — resume to continue monitoring")}
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
                <div
                  className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: "rgba(15,23,42,0.7)", color: faceDetected ? "#22c55e" : "#f59e0b" }}
                >
                  <div className={`w-2 h-2 rounded-full ${faceDetected ? "bg-green-400" : "bg-amber-400"} animate-pulse`} />
                  {faceDetected ? "Face detected" : "No face"}
                </div>
              )}

              {predictError && (
                <div
                  className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-lg text-xs text-white"
                  style={{ backgroundColor: "rgba(239,68,68,0.85)" }}
                >
                  {predictError} — is the backend running?
                </div>
              )}

              {["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"].map((pos, i) => (
                <div
                  key={i}
                  className={`absolute ${pos} w-6 h-6`}
                  style={{
                    borderTop: i < 2 ? "2px solid #22c55e60" : "none",
                    borderBottom: i >= 2 ? "2px solid #22c55e60" : "none",
                    borderLeft: [0, 2].includes(i) ? "2px solid #22c55e60" : "none",
                    borderRight: [1, 3].includes(i) ? "2px solid #22c55e60" : "none",
                  }}
                />
              ))}
            </div>
          </Card>

          <Card className="p-5 fu-stagger" style={{ "--fu-i": 1 }}>
            <SectionTitle
              title="State Confidence"
              subtitle="Model probability across the four tracked states"
              className="mb-5"
            />
            <div className="space-y-4">
              {CLASSES.map((cls) => {
                const active = state === cls;
                const pct = (probs[cls] || 0) * 100;
                return (
                  <div key={cls}>
                    <div className="flex justify-between mb-1.5">
                      <span
                        className="flex items-center gap-2 text-sm"
                        style={{ color: active ? STATE_CFG[cls].color : "#78716c", fontWeight: active ? 700 : 400 }}
                      >
                        {STATE_CFG[cls].icon} {cls}
                        {active && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: `${STATE_CFG[cls].color}18`, color: STATE_CFG[cls].color }}
                          >
                            current
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-bold" style={{ color: STATE_CFG[cls].color }}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <Meter pct={pct} color={STATE_CFG[cls].color} height={12} glow={active} />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
          <Card
            className="p-6 text-center transition-all duration-700 fu-stagger relative overflow-hidden"
            style={{
              "--fu-i": 2,
              background: `linear-gradient(135deg,${shownCfg.color}15,rgba(255,255,255,0.5))`,
              borderColor: shownCfg.border,
              boxShadow: `0 0 40px ${shownCfg.color}15`,
            }}
          >
            <div
              className="absolute rounded-full blur-3xl pointer-events-none left-1/2 -translate-x-1/2 -top-16"
              style={{ width: 200, height: 200, backgroundColor: shownCfg.color, opacity: 0.12 }}
            />
            <div className="relative">
              <div className="text-6xl mb-3">{shownCfg.icon}</div>
              <p className="text-3xl font-bold mb-1" style={{ color: shownCfg.color }}>{shownCfg.label}</p>
              <p className="text-xs text-slate-600 uppercase tracking-widest">
                {showingNoFace ? "Look at the camera to resume detection" : "Detected State"}
              </p>
              <div className="mt-5 max-w-55 mx-auto">
                <Meter pct={displayConfidence * 100} color={shownCfg.color} height={8} glow />
                <p className="text-xs font-semibold mt-2" style={{ color: shownCfg.color }}>
                  Confidence: {Math.round(displayConfidence * 100)}%
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5 fu-stagger" style={{ "--fu-i": 3 }}>
            <SectionTitle
              title="Manual Override"
              subtitle="Overrides live detection for a few seconds"
              className="mb-4"
            />
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STATE_CFG).map(([s, c]) => (
                <button
                  key={s}
                  onClick={() => handleStateSelect(s)}
                  className="py-3 px-4 rounded-xl text-sm font-semibold border transition-all"
                  style={{
                    borderColor: state === s ? c.color : "rgba(0,0,0,0.08)",
                    backgroundColor: state === s ? `${c.color}18` : "rgba(0,0,0,0.02)",
                    color: state === s ? c.color : "#78716c",
                    boxShadow: state === s ? `0 0 15px ${c.color}25` : "none",
                  }}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5 fu-stagger" style={{ "--fu-i": 4 }}>
            <SectionTitle title="Session Info" className="mb-2" />
            <div>
              <DataRow icon="⚡" label="Session Status" value={statusMeta.label} color={statusMeta.color} />
              <DataRow icon="⏱" label="This Session (focus)" value={formatHM(focusMin, { allowSeconds: true })} color="#22c55e" />
              <DataRow icon="😴" label="This Session (distraction)" value={formatHM(distMin, { allowSeconds: true })} color="#f97316" last />
            </div>
            {sessionStatus === "ended" ? (
              <button
                onClick={startSession}
                className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm border transition-all"
                style={{ backgroundColor: "#22c55e15", borderColor: "#22c55e40", color: "#22c55e" }}
              >
                ▶ Start Session
              </button>
            ) : (
              <button
                onClick={sessionOn ? pauseSession : resumeSession}
                className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm border transition-all"
                style={{
                  backgroundColor: sessionOn ? "#f59e0b15" : "#22c55e15",
                  borderColor: sessionOn ? "#f59e0b40" : "#22c55e40",
                  color: sessionOn ? "#d97706" : "#22c55e",
                }}
              >
                {sessionOn ? "⏸ Pause Session" : "▶ Resume Session"}
              </button>
            )}
            <button
              onClick={endSession}
              disabled={sessionStatus === "ended"}
              className="w-full mt-2 py-2.5 rounded-xl font-semibold text-sm border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#ef444415", borderColor: "#ef444440", color: "#ef4444" }}
            >
              ⏹ End Session
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
