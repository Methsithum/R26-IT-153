import React from "react";
import Card from "../Card";
import TreeSVG from "../TreeSVG";
import { STATE_CFG, LEVEL_DATA } from "../focusData";
import { PageHeader, SectionTitle, StatTile, Meter, Badge, DataRow } from "../ui";

const STATE_BLURB = {
  Focused: "Tree grows and sparkles with energy!",
  Fatigue: "Tree droops and loses vibrancy...",
  Anxiety: "Tree shakes and trembles nervously...",
  Boredom: "Tree becomes sparse and still...",
  NoFace: "Tree waits quietly until you're back in frame.",
};

const POINT_RULES = [
  { action: "Focus 1 minute", icon: "⏱", pts: "+10", color: "#22c55e" },
  { action: "25-min continuous focus", icon: "⚡", pts: "+50 bonus", color: "#f59e0b" },
  { action: "Complete daily goal", icon: "🎯", pts: "+100 bonus", color: "#a855f7" },
  { action: "Complete Break Challenge", icon: "😴", pts: "+20", color: "#f97316" },
  { action: "Complete Calm Quest", icon: "🌿", pts: "+15", color: "#ef4444" },
  { action: "Complete Bonus Content", icon: "🎬", pts: "+25", color: "#3b82f6" },
];

export default function TabTree({ state, points, streak, focusMin, LEVEL_DATA: LD = LEVEL_DATA }) {
  const cfg = STATE_CFG[state] || STATE_CFG.Focused;
  const lv = LD.filter((l) => points >= l.min).length - 1;
  const current = LD[lv];
  const next = LD[lv + 1];

  // Progress through the *current* level band, not toward an absolute total.
  const bandSize = next ? next.min - current.min : 1;
  const levelPct = next ? ((points - current.min) / bandSize) * 100 : 100;
  const ptsToNext = next ? Math.max(next.min - points, 0) : 0;

  return (
    <div className="fu-view">
      <PageHeader
        icon="🌳"
        title="My Focus Tree"
        subtitle="Your tree grows with every focused minute you earn"
        right={<Badge color={lv === 3 ? "#f59e0b" : cfg.color}>{current.icon} {current.name}</Badge>}
      />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
          <Card
            className="p-8 flex flex-col items-center relative overflow-hidden transition-all duration-700 fu-stagger"
            style={{
              "--fu-i": 0,
              background: `linear-gradient(180deg,${cfg.color}08,rgba(255,255,255,0.5))`,
              borderColor: cfg.border,
            }}
          >
            {/* Soft halo behind the tree, tinted by the live state color. */}
            <div
              className="absolute rounded-full blur-3xl pointer-events-none transition-all duration-700"
              style={{ width: 260, height: 260, top: -40, backgroundColor: cfg.color, opacity: 0.12 }}
            />
            <div className="relative">
              <TreeSVG state={state} points={points} size={220} />
            </div>

            <div className="text-center mt-4 relative">
              <p className="text-2xl font-bold text-slate-900 mb-1">{current.icon} {current.name}</p>
              <p className="text-sm text-slate-600">Level {lv + 1} of {LD.length}</p>
            </div>

            <div className="w-full mt-6 relative">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-600">{next ? `Next: ${next.name}` : "Maximum level"}</span>
                <span className="font-semibold" style={{ color: cfg.color }}>
                  {next ? `${ptsToNext} pts to go` : "✨ Complete"}
                </span>
              </div>
              <Meter
                pct={levelPct}
                color={lv === 3 ? "#f59e0b" : "#22c55e"}
                height={10}
                glow
                sheen={!!next}
              />
              <p className="text-[11px] text-slate-500 mt-1.5 text-right">
                {points.toLocaleString()} {next ? `/ ${next.min.toLocaleString()}` : ""} pts
              </p>
            </div>
          </Card>

          <Card className="p-5 fu-stagger" style={{ "--fu-i": 1 }}>
            <SectionTitle title="Growth Journey" subtitle="Every level your tree can reach" className="mb-4" />
            <div className="relative">
              {/* Rail connecting the level markers into a single timeline. */}
              <div className="absolute left-[15px] top-3 bottom-3 w-px bg-slate-200" />
              <div className="space-y-4">
                {LD.map((lvl, i) => {
                  const active = i === lv;
                  const passed = i < lv;
                  const markerColor = passed ? "#22c55e" : active ? "#f59e0b" : "#94a3b8";
                  return (
                    <div key={lvl.name} className="flex items-center gap-3 relative">
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 relative z-10 transition-all"
                        style={{
                          backgroundColor: passed || active ? `${markerColor}15` : "rgba(255,255,255,0.9)",
                          border: `1.5px solid ${markerColor}${passed || active ? "60" : "30"}`,
                          boxShadow: active ? `0 0 12px ${markerColor}35` : "none",
                        }}
                      >
                        {passed ? "✅" : active ? lvl.icon : "🔒"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs mb-1 gap-2">
                          <span
                            className="truncate"
                            style={{ color: markerColor, fontWeight: active ? 700 : passed ? 600 : 400 }}
                          >
                            {lvl.name}
                          </span>
                          <span className="text-slate-500 whitespace-nowrap">{lvl.min}–{lvl.max} pts</span>
                        </div>
                        <Meter
                          pct={passed ? 100 : active ? levelPct : 0}
                          color={passed ? "#22c55e" : "#f59e0b"}
                          height={6}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        <div className="col-span-12 md:col-span-7 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Points", value: points.toLocaleString(), icon: "✦", color: "#f59e0b", unit: "pts" },
              { label: "Focus Today", value: Math.round(focusMin), icon: "⏱", color: "#22c55e", unit: "min" },
              { label: "Current Streak", value: streak, icon: "🔥", color: "#f97316", unit: "min" },
              { label: "Growth Stages", value: lv + 1, icon: "🌱", color: "#22c55e", unit: `/ ${LD.length}` },
            ].map((s, i) => (
              <StatTile key={s.label} {...s} index={i} />
            ))}
          </div>

          <Card className="p-5 fu-stagger" style={{ "--fu-i": 2 }}>
            <SectionTitle
              title="Tree State Guide"
              subtitle="How your tree reacts to each detected state"
              className="mb-4"
            />
            <div className="space-y-2.5">
              {Object.entries(STATE_CFG).map(([s, c]) => {
                const isNow = state === s;
                return (
                  <div
                    key={s}
                    className="flex items-start gap-3 p-3 rounded-xl border transition-all"
                    style={{
                      borderColor: isNow ? `${c.color}55` : "rgba(0,0,0,0.05)",
                      backgroundColor: isNow ? `${c.color}0d` : "rgba(255,255,255,0.35)",
                      boxShadow: isNow ? `0 0 16px ${c.color}18` : "none",
                    }}
                  >
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: `${c.color}12`, border: `1px solid ${c.color}25` }}
                    >
                      {c.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: c.color }}>{c.label}</p>
                      <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{STATE_BLURB[s]}</p>
                    </div>
                    {isNow && (
                      <span
                        className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"
                        style={{ backgroundColor: `${c.color}18`, color: c.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: c.color }} />
                        Now
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 fu-stagger" style={{ "--fu-i": 3 }}>
            <SectionTitle title="Points Guide" subtitle="Ways to grow your tree faster" className="mb-2" />
            <div>
              {POINT_RULES.map((p, i) => (
                <DataRow
                  key={p.action}
                  icon={p.icon}
                  label={p.action}
                  value={p.pts}
                  color={p.color}
                  last={i === POINT_RULES.length - 1}
                />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
