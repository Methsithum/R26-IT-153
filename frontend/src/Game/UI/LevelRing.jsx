import { XP_PER_LEVEL, levelFromXp, xpIntoLevel } from "../data/progression";

export default function LevelRing({
  xp = 0,
  level,
  size = 96,
  stroke = 8,
  className = "",
  tone = "journal",
}) {
  const shownLevel = level ?? levelFromXp(xp);
  const into = xpIntoLevel(xp);
  const pct = Math.min(1, into / XP_PER_LEVEL);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const journal = tone === "journal";
  const brand = tone === "brand";
  const track = brand
    ? "rgba(124, 58, 237, 0.18)"
    : journal
      ? "rgba(180, 83, 9, 0.18)"
      : "rgba(148, 163, 184, 0.35)";
  const innerPad = size >= 80 ? 9 : 6;
  const levelSize = size >= 90 ? "text-2xl" : size >= 70 ? "text-xl" : "text-sm";
  const labelSize = size >= 70 ? "text-[9px]" : "text-[7px]";
  const gradId = `level-ring-${tone}-${size}-${stroke}`;

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            {brand ? (
              <>
                <stop offset="0%" stopColor="#ac85ff" />
                <stop offset="100%" stopColor="#7c3aed" />
              </>
            ) : journal ? (
              <>
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#b45309" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="55%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#38bdf8" />
              </>
            )}
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div
        className={`absolute flex flex-col items-center justify-center rounded-full shadow-inner ${
          brand ? "bg-gradient-to-br from-brand-200 to-brand-600" : "bg-gradient-to-br from-amber-200 to-amber-700"
        }`}
        style={{ inset: innerPad }}
      >
        <div
          className={`absolute inset-[3px] flex flex-col items-center justify-center rounded-full ${
            brand ? "bg-white dark:bg-[#1a1530]" : journal ? "bg-[#f5ecd9]" : "bg-slate-950"
          }`}
        >
          <div className={`${labelSize} uppercase tracking-[0.18em] leading-none ${
            brand ? "text-brand-400" : journal ? "text-stone-500" : "text-slate-400"
          }`}>
            Lv
          </div>
          <div className={`${levelSize} font-black leading-none ${
            brand ? "text-brand-600 dark:text-brand-300" : journal ? "text-amber-800" : "text-amber-200"
          }`}>
            {shownLevel}
          </div>
        </div>
      </div>
    </div>
  );
}
