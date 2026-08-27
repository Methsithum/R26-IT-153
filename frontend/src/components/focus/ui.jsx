import React from "react";
import Card from "./Card";

// Shared presentation primitives for the FocusForest tabs.
//
// Every color is supplied by the caller from STATE_CFG / the existing per-metric
// hexes — nothing in here introduces a color of its own beyond the slate
// neutrals already used across the app.

export function PageHeader({ icon, title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        {icon && <span className="text-2xl leading-none">{icon}</span>}
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function SectionTitle({ title, subtitle, right, className = "" }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div>
        <h3 className="font-semibold text-slate-900 leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Badge({ color, children, soft = true, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${className}`}
      style={{
        color,
        backgroundColor: soft ? `${color}12` : "transparent",
        borderColor: `${color}35`,
      }}
    >
      {children}
    </span>
  );
}

// A filled track. `pct` is clamped so an out-of-range value can't overflow the
// rail, and NaN (from a 0/0 ratio before any data exists) renders as empty.
export function Meter({ pct, color, height = 8, glow = false, sheen = false, track = "#cbd5e1" }) {
  const safe = Number.isFinite(pct) ? Math.max(0, Math.min(pct, 100)) : 0;
  return (
    <div className="rounded-full overflow-hidden" style={{ height, backgroundColor: track }}>
      <div
        className={`h-full rounded-full relative overflow-hidden transition-all duration-700 ${sheen && safe > 0 ? "fu-sheen" : ""}`}
        style={{
          width: `${safe}%`,
          backgroundColor: color,
          boxShadow: glow && safe > 0 ? `0 0 10px ${color}55` : "none",
        }}
      />
    </div>
  );
}

export function ProgressRing({ pct, color, size = 120, stroke = 10, children, track = "#e2e8f0" }) {
  const safe = Number.isFinite(pct) ? Math.max(0, Math.min(pct, 100)) : 0;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - safe / 100)}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function StatTile({ icon, label, value, unit, color, sub, index = 0 }) {
  return (
    <Card hover className="p-4 fu-stagger" style={{ "--fu-i": index }}>
      <div className="flex items-start justify-between gap-2">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ backgroundColor: `${color}12`, border: `1px solid ${color}25` }}
        >
          {icon}
        </span>
        {sub && <span className="text-[11px] text-slate-500 text-right leading-tight">{sub}</span>}
      </div>
      <p className="text-2xl font-bold mt-3 leading-none" style={{ color }}>
        {value}
        {unit && <span className="text-sm font-semibold ml-1 opacity-70">{unit}</span>}
      </p>
      <p className="text-xs text-slate-600 mt-1.5">{label}</p>
    </Card>
  );
}

// Key/value line used by the summary lists. `last` drops the divider so the
// final row doesn't leave a dangling rule above the card padding.
export function DataRow({ label, value, color, icon, last = false }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2.5 ${last ? "" : "border-b border-slate-200"}`}>
      <span className="text-slate-600 text-sm flex items-center gap-2 min-w-0">
        {icon && <span className="text-base shrink-0">{icon}</span>}
        <span className="truncate">{label}</span>
      </span>
      <span className="font-bold text-sm whitespace-nowrap" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

export function EmptyState({ icon = "📭", title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4">
      <span className="text-3xl opacity-40 mb-2">{icon}</span>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {hint && <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">{hint}</p>}
    </div>
  );
}
