import React, { useId } from "react";
import { STATE_CFG, TREE_MOOD, levelIndexFromPoints } from "./focusData";

export default function TreeSVG({ state, points, size = 220, fx = null, fxKey = 0 }) {
  const uid = useId().replace(/:/g, "");
  const cfg = STATE_CFG[state] || STATE_CFG.Focused;
  const mood = TREE_MOOD[state] || TREE_MOOD.Focused;
  const lv = levelIndexFromPoints(points);
  const isGolden = lv >= 3;
  const isHappy = state === "Focused";
  const isSad = state === "Boredom" || state === "Fatigue";
  const canopy = isGolden ? "#f59e0b" : cfg.color;
  const canopyDeep = isGolden ? "#d97706" : cfg.color;
  const faceY = [168, 118, 86, 58][lv] || 86;
  const watering = fx === "water";
  const wilting = fx === "wilt";

  const motion = watering
    ? "treeBob 0.6s ease-in-out infinite"
    : wilting
      ? "treeWiltHit 0.35s ease-in 2"
      : state === "Anxiety"
        ? "treeShake 0.45s ease-in-out infinite alternate"
        : isSad
          ? "treeDroop 2.6s ease-in-out infinite alternate"
          : "treeBob 3.2s ease-in-out infinite";

  return (
    <svg
      width={size}
      height={size * 1.18}
      viewBox="0 0 220 260"
      style={{ filter: `drop-shadow(0 10px 22px ${cfg.color}40)`, animation: motion }}
    >
      <defs>
        <radialGradient id={`${uid}-soil`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#c4a574" />
          <stop offset="100%" stopColor="#8b6914" stopOpacity="0.55" />
        </radialGradient>
        <radialGradient id={`${uid}-canopyG`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor={isGolden ? "#fde68a" : "#ffffff"} stopOpacity={isGolden ? 0.55 : 0.28} />
          <stop offset="55%" stopColor={canopy} />
          <stop offset="100%" stopColor={canopyDeep} />
        </radialGradient>
        <linearGradient id={`${uid}-bark`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6b4226" />
          <stop offset="45%" stopColor="#a16207" />
          <stop offset="100%" stopColor="#5c3a1e" />
        </linearGradient>
      </defs>

      {/* ground */}
      <ellipse cx="110" cy="238" rx="72" ry="14" fill={cfg.color} opacity="0.14" />
      <ellipse cx="110" cy="236" rx="54" ry="10" fill={`url(#${uid}-soil)`} opacity="0.85" />

      {lv >= 1 && (
        <g opacity="0.45" fill="#6b4226">
          <path d="M96 226 Q78 232 62 240" stroke="#6b4226" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M124 226 Q144 232 160 240" stroke="#6b4226" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      )}

      {/* trunk grows with level */}
      {lv === 0 ? (
        <path d="M108 228 C107 210 109 196 110 184 C111 196 113 210 112 228 Z" fill={`url(#${uid}-bark)`} />
      ) : (
        <>
          <path
            d={lv >= 2
              ? "M99 232 C96 190 98 150 104 118 L116 118 C122 150 124 190 121 232 Z"
              : "M102 232 C100 200 102 168 107 142 L113 142 C118 168 120 200 118 232 Z"}
            fill={`url(#${uid}-bark)`}
          />
          {lv >= 2 && (
            <g stroke="#6b4226" strokeWidth="7" fill="none" strokeLinecap="round">
              <path d="M108 150 Q78 132 58 118" />
              <path d="M112 148 Q146 128 168 112" />
            </g>
          )}
        </>
      )}

      {/* Seedling leaves */}
      {lv === 0 && (
        <g style={{ transformOrigin: "110px 180px", animation: "leafSway 3.4s ease-in-out infinite" }}>
          <ellipse cx="96" cy="176" rx="16" ry="10" fill={canopy} transform="rotate(-28 96 176)" />
          <ellipse cx="124" cy="174" rx="16" ry="10" fill={canopy} transform="rotate(26 124 174)" />
          <circle cx="110" cy="168" r="7" fill={canopy} />
        </g>
      )}

      {/* Growing plant */}
      {lv === 1 && (
        <g opacity={isSad ? 0.78 : 1}>
          <ellipse cx="110" cy="128" rx="42" ry="34" fill={`url(#${uid}-canopyG)`} style={{ animation: "leafSway 4s ease-in-out infinite" }} />
          <ellipse cx="86" cy="142" rx="24" ry="18" fill={canopy} opacity="0.92" />
          <ellipse cx="136" cy="140" rx="24" ry="18" fill={canopy} opacity="0.92" />
        </g>
      )}

      {/* Focus tree canopy */}
      {lv >= 2 && (
        <g opacity={isSad ? 0.8 : 1}>
          <ellipse cx="110" cy="88" rx="58" ry="46" fill={`url(#${uid}-canopyG)`} style={{ animation: "leafSway 4s ease-in-out infinite" }} />
          <ellipse cx="62" cy="104" rx="32" ry="26" fill={canopy} opacity="0.95" style={{ animation: "leafSway 3.6s ease-in-out infinite 0.2s" }} />
          <ellipse cx="158" cy="100" rx="34" ry="28" fill={canopy} opacity="0.95" style={{ animation: "leafSway 3.2s ease-in-out infinite 0.4s" }} />
          <ellipse cx="88" cy="62" rx="28" ry="22" fill={canopy} />
          <ellipse cx="132" cy="58" rx="30" ry="24" fill={canopy} />
          {!isSad && (
            <>
              <circle cx="78" cy="96" r="4" fill="#f43f5e" opacity="0.9" />
              <circle cx="148" cy="90" r="4" fill="#f43f5e" opacity="0.85" />
              <circle cx="112" cy="70" r="3.5" fill="#fb7185" />
            </>
          )}
        </g>
      )}

      {isGolden && (
        <g>
          <ellipse cx="110" cy="42" rx="22" ry="16" fill="#fbbf24" style={{ animation: "leafSway 2.6s ease-in-out infinite" }} />
          <path d="M110 18 L113 30 L126 30 L116 38 L119 50 L110 42 L101 50 L104 38 L94 30 L107 30 Z" fill="#fde68a" style={{ animation: "starPulse 1.6s ease-in-out infinite" }} />
        </g>
      )}

      {isHappy && (
        <g opacity="0.95" style={{ animation: "sparkle 1.6s ease-in-out infinite" }}>
          <text x="38" y="92" fontSize="16">✨</text>
          <text x="168" y="78" fontSize="13">✨</text>
          {lv >= 2 && <text x="172" y="142" fontSize="13">🌿</text>}
        </g>
      )}
      {state === "Fatigue" && <text x="164" y="96" fontSize="18" style={{ animation: "zzz 1.8s ease-in-out infinite" }}>💤</text>}
      {state === "Anxiety" && <text x="166" y="102" fontSize="15">💦</text>}
      {state === "Boredom" && (
        <g opacity="0.85">
          <text x="36" y="128" fontSize="15">🍂</text>
          <text x="48" y="148" fontSize="12">🍂</text>
        </g>
      )}

      <text
        x="110"
        y={faceY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={lv >= 2 ? 32 : 28}
        style={{ animation: isHappy ? "facePop 2.2s ease-in-out infinite" : "none" }}
      >
        {mood.emoji}
      </text>

      {watering && (
        <g key={`water-${fxKey}`}>
          <g style={{ transformOrigin: "178px 52px", animation: "canPour 1.8s ease-in-out forwards" }}>
            <ellipse cx="178" cy="48" rx="16" ry="11" fill="#38bdf8" stroke="#0369a1" strokeWidth="2" />
            <rect x="188" y="44" width="14" height="7" rx="2" fill="#0284c7" />
            <path d="M162 50 Q154 58 150 70" stroke="#0284c7" strokeWidth="4" fill="none" strokeLinecap="round" />
          </g>
          <circle cx="148" cy="78" r="3.2" fill="#38bdf8" style={{ animation: "dropFall 1.1s ease-in 0.15s forwards" }} />
          <circle cx="140" cy="70" r="2.6" fill="#7dd3fc" style={{ animation: "dropFall 1.15s ease-in 0.28s forwards" }} />
          <circle cx="156" cy="74" r="2.8" fill="#0ea5e9" style={{ animation: "dropFall 1.05s ease-in 0.4s forwards" }} />
          <ellipse cx="110" cy="228" rx="18" ry="5" fill="#38bdf8" opacity="0" style={{ animation: "puddle 1.6s ease-out 0.7s forwards" }} />
          <text x="42" y="48" fontSize="16" fontWeight="700" fill="#16a34a" style={{ animation: "floatLabel 1.8s ease-out forwards" }}>+5</text>
        </g>
      )}

      {wilting && (
        <g key={`wilt-${fxKey}`}>
          <ellipse cx="92" cy="100" rx="8" ry="5" fill={canopy} style={{ animation: "leafFall 1.5s ease-in forwards" }} />
          <ellipse cx="130" cy="88" rx="7" ry="4.5" fill={canopyDeep} style={{ animation: "leafFall 1.65s ease-in 0.12s forwards" }} />
          <ellipse cx="70" cy="110" rx="6" ry="4" fill="#a16207" style={{ animation: "leafFall 1.4s ease-in 0.22s forwards" }} />
          <text x="158" y="64" fontSize="16" fontWeight="700" fill="#dc2626" style={{ animation: "floatLabel 1.8s ease-out forwards" }}>−5</text>
        </g>
      )}

      <style>{`
        @keyframes treeBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes treeDroop{0%{transform:translateY(2px) rotate(-1.2deg)}100%{transform:translateY(7px) rotate(1.8deg)}}
        @keyframes treeShake{0%{transform:rotate(-2.8deg)}100%{transform:rotate(2.8deg)}}
        @keyframes leafSway{0%,100%{transform:rotate(-2deg) scale(1)}50%{transform:rotate(2.4deg) scale(1.04)}}
        @keyframes starPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.65;transform:scale(1.18)}}
        @keyframes sparkle{0%,100%{opacity:0.35;transform:translateY(0)}50%{opacity:1;transform:translateY(-5px)}}
        @keyframes zzz{0%,100%{opacity:0.4;transform:translateY(0)}50%{opacity:1;transform:translateY(-9px)}}
        @keyframes facePop{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
        @keyframes canPour{0%{transform:translate(8px,-6px) rotate(-18deg);opacity:0}18%{opacity:1}45%{transform:translate(0,0) rotate(28deg)}100%{transform:translate(0,0) rotate(22deg);opacity:0.2}}
        @keyframes dropFall{0%{opacity:0;transform:translateY(0)}12%{opacity:1}100%{opacity:0;transform:translateY(148px)}}
        @keyframes puddle{0%{opacity:0;transform:scaleX(0.2)}40%{opacity:0.45}100%{opacity:0;transform:scaleX(1.2)}}
        @keyframes leafFall{0%{opacity:1;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(18px,120px) rotate(50deg)}}
        @keyframes floatLabel{0%{opacity:0;transform:translateY(8px)}25%{opacity:1}100%{opacity:0;transform:translateY(-22px)}}
        @keyframes treeWiltHit{0%{transform:rotate(0)}40%{transform:rotate(-4deg) scale(0.97)}100%{transform:rotate(0)}}
      `}</style>
    </svg>
  );
}
