import { motion } from "framer-motion";
import { CAMPUS_MAPS, isMapUnlocked } from "../../Game/data/maps";
import { useGameStore } from "../../Game/state/GameStateManager";
import { useMapStore } from "../../Game/state/mapStore";

const PINS = {
  "main-campus": { x: 200, y: 132 },
  "evening-quad": { x: 292, y: 88 },
  "rainy-walk": { x: 108, y: 92 },
  "night-lamps": { x: 198, y: 58 },
  "sports-field": { x: 92, y: 198 },
  "lakeside-path": { x: 318, y: 186 },
};

function MapPreview({ map }) {
  const night = Boolean(map.lightText);
  return (
    <div
      className="relative h-full min-h-[168px] overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${map.lights.hemiSky} 0%, ${map.fog.color} 46%, ${map.grass} 46%, ${map.grassDark} 100%)`,
      }}
    >
      <div
        className="absolute rounded-full blur-[2px]"
        style={{
          width: night ? 22 : 34,
          height: night ? 22 : 34,
          right: "18%",
          top: night ? "18%" : "12%",
          background: night ? "#f5d76e" : "#fff4c4",
          boxShadow: night ? "0 0 28px 8px rgba(245,215,110,0.45)" : "0 0 24px 6px rgba(255,244,196,0.55)",
        }}
      />
      {map.water && (
        <div
          className="absolute right-[-8%] bottom-[18%] h-[38%] w-[46%] rounded-[48%] opacity-90"
          style={{ background: `linear-gradient(180deg, ${map.water}, #1f4a56)` }}
        />
      )}
      <div
        className="absolute bottom-0 left-1/2 h-[54%] w-[42%]"
        style={{
          background: map.road,
          clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)",
          transform: "translateX(-50%)",
          boxShadow: `inset 0 0 0 2px ${map.roadAccent}`,
        }}
      />
      <div
        className="absolute bottom-0 left-1/2 h-[54%] w-[4px] opacity-80"
        style={{
          background: map.line,
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
          transform: "translateX(-50%)",
          maskImage: "repeating-linear-gradient(#000 0 10px, transparent 10px 18px)",
        }}
      />
      {[18, 28, 72, 80].map((left, i) => (
        <div
          key={left}
          className="absolute"
          style={{
            left: `${left}%`,
            bottom: i < 2 ? "38%" : "32%",
          }}
        >
          <div className="mx-auto h-5 w-1.5 rounded-sm" style={{ background: map.treeTrunk }} />
          <div
            className="-mt-3 h-8 w-8 rounded-full"
            style={{ background: map.treeCanopy, marginLeft: -10 }}
          />
        </div>
      ))}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-white/10" />
    </div>
  );
}

function CampusAtlas({ activeId, level, onPick }) {
  return (
    <svg viewBox="0 0 400 260" className="h-auto w-full">
      <defs>
        <linearGradient id="atlas-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d7eccc" />
          <stop offset="100%" stopColor="#b7d4a4" />
        </linearGradient>
        <linearGradient id="atlas-water" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7ec8d4" />
          <stop offset="100%" stopColor="#3d7c8c" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="384" height="244" rx="22" fill="#f2ecff" stroke="#cbb3ff" strokeWidth="3" />
      <rect x="22" y="22" width="356" height="216" rx="16" fill="url(#atlas-ground)" />
      <ellipse cx="318" cy="186" rx="58" ry="32" fill="url(#atlas-water)" opacity="0.9" />
      <rect x="58" y="168" width="86" height="54" rx="10" fill="#7cb85a" stroke="#4e8c45" strokeWidth="2" />
      <path
        d="M200 44 C 168 70, 150 96, 168 128 C 184 154, 210 168, 200 214"
        fill="none"
        stroke="#c4b49a"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <path
        d="M168 128 C 120 122, 96 150, 92 198"
        fill="none"
        stroke="#c4b49a"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M184 110 C 240 96, 280 92, 318 170"
        fill="none"
        stroke="#c4b49a"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <rect x="176" y="118" width="48" height="28" rx="3" fill="#d9c4a0" stroke="#8a6a42" strokeWidth="1.4" />
      <rect x="86" y="78" width="36" height="22" rx="3" fill="#cbb896" stroke="#8a6a42" strokeWidth="1.4" />
      <rect x="268" y="70" width="40" height="22" rx="3" fill="#d2b48c" stroke="#8a6a42" strokeWidth="1.4" />
      <text x="200" y="246" textAnchor="middle" fill="#7a5a38" fontSize="8" letterSpacing="2.4">
        CAMPUS ATLAS
      </text>
      {CAMPUS_MAPS.map((item) => {
        const pin = PINS[item.id];
        if (!pin) return null;
        const unlocked = isMapUnlocked(item, level);
        const selected = item.id === activeId;
        return (
          <g
            key={item.id}
            className={unlocked ? "cursor-pointer" : "cursor-not-allowed"}
            onClick={() => unlocked && onPick(item.id)}
          >
            {selected && (
              <circle cx={pin.x} cy={pin.y} r="16" fill={item.accent} opacity="0.22">
                <animate attributeName="r" values="12;18;12" dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx={pin.x}
              cy={pin.y}
              r={selected ? 9 : 7.5}
              fill={unlocked ? item.accent : "#8a8176"}
              stroke="#fff8ee"
              strokeWidth="2.2"
            />
            <text
              x={pin.x}
              y={pin.y - 14}
              textAnchor="middle"
              fill={unlocked ? "#3f2a14" : "#6b6358"}
              fontSize="8"
              fontWeight="700"
            >
              {unlocked ? item.icon : "🔒"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function CampusMapsPage() {
  const level = useGameStore((s) => s.level);
  const selectedMapId = useMapStore((s) => s.selectedMapId);
  const activeMap =
    CAMPUS_MAPS.find((item) => item.id === selectedMapId && isMapUnlocked(item, level)) || CAMPUS_MAPS[0];
  const unlockedCount = CAMPUS_MAPS.filter((item) => isMapUnlocked(item, level)).length;
  const nextLock = CAMPUS_MAPS.find((item) => !isMapUnlocked(item, level));

  function pick(id) {
    useMapStore.getState().selectMap(id, level);
  }

  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-500 dark:text-brand-300">
        Campus atlas
      </div>
      <h2 className="font-display text-xl font-bold text-slate-800 dark:text-white">Locate your next run</h2>
      <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-300">
        Pins mark every avenue on campus. Tap an open pin or postcard to walk it on your next journal day.
      </p>

      <div className="mt-4 overflow-hidden rounded-[28px] border border-brand-100 dark:border-white/10 bg-brand-50/80 dark:bg-white/5 shadow-[var(--shadow-playful)]">
        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-3 sm:p-4">
            <CampusAtlas activeId={activeMap.id} level={level} onPick={pick} />
          </div>
          <div className="relative min-h-[200px] overflow-hidden lg:min-h-0">
            <MapPreview map={activeMap} />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">Now playing</div>
              <div className="text-xl font-bold text-white">{activeMap.name}</div>
              <div className="text-sm text-white/85">
                {activeMap.place} · {activeMap.hour}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 mb-3 flex items-end justify-between gap-3">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {unlockedCount} of {CAMPUS_MAPS.length} avenues open
        </div>
        {nextLock && (
          <div className="text-[11px] text-slate-400">
            Next unlock · {nextLock.name} at Level {nextLock.unlockLevel}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CAMPUS_MAPS.map((item, index) => {
          const unlocked = isMapUnlocked(item, level);
          const selected = activeMap.id === item.id;
          const light = Boolean(item.lightText) && unlocked;
          return (
            <motion.button
              key={item.id}
              type="button"
              disabled={!unlocked}
              onClick={() => pick(item.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`overflow-hidden rounded-2xl border text-left shadow-sm transition-all ${
                selected
                  ? "border-brand-500 ring-2 ring-brand-400/30"
                  : unlocked
                    ? "border-brand-100 dark:border-white/10 hover:-translate-y-0.5 hover:shadow-md"
                    : "border-slate-200 dark:border-white/10 cursor-not-allowed"
              }`}
            >
              <div className="relative h-24">
                {unlocked ? (
                  <MapPreview map={item} />
                ) : (
                  <div className="flex h-full items-center justify-center bg-brand-50 dark:bg-white/5 text-2xl grayscale">🔒</div>
                )}
                <div className="absolute left-3 top-3 text-lg drop-shadow">{unlocked ? item.icon : ""}</div>
                {selected && (
                  <span
                    className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      light ? "bg-white/20 text-white" : "bg-white/90 text-brand-700"
                    }`}
                  >
                    Playing
                  </span>
                )}
              </div>
              <div
                className="px-3 py-3"
                style={{
                  background: unlocked
                    ? `linear-gradient(135deg, ${item.cardFrom}55, ${item.cardTo}40)`
                    : "#f4f0ff",
                }}
              >
                <div className={`text-sm font-bold ${unlocked ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>{item.name}</div>
                <div className={`text-[11px] ${unlocked ? "text-slate-600 dark:text-slate-300" : "text-slate-400"}`}>
                  {unlocked ? `${item.place} · ${item.tagline}` : `Unlocks at Level ${item.unlockLevel}`}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
