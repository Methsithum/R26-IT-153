import React from "react";
import { STATE_CFG, LEVEL_DATA, TREE_MOOD } from "./focusData";

export default function TreeSVG({ state, points, size = 200 }) {
  const cfg = STATE_CFG[state] || STATE_CFG.Focused;
  const mood = TREE_MOOD[state] || TREE_MOOD.Focused;
  const lv = Math.max(0, LEVEL_DATA.filter((l) => (points || 0) >= l.min).length - 1);
  const isGolden = lv === 3;
  const leafFill = isGolden ? "#f59e0b" : cfg.color;
  const isHappy = state === "Focused";
  const isSad = state === "Boredom" || state === "Fatigue";
  const faceY = lv >= 3 ? 52 : lv >= 2 ? 80 : lv >= 1 ? 116 : 155;
  const faceSize = lv >= 2 ? 34 : 30;

  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 200 224"
      style={{
        filter: `drop-shadow(0 0 18px ${cfg.color}55)`,
        animation: state === "Anxiety" ? "treeShake 0.4s ease-in-out infinite alternate"
          : isSad ? "treeDroop 2.4s ease-in-out infinite alternate"
          : "treeBob 3s ease-in-out infinite",
      }}>
      <ellipse cx="100" cy="214" rx="40" ry="7" fill={cfg.color} opacity="0.18" />
      <rect x="90" y="150" width="20" height="64" rx="7"
        fill="#8B5E3C"
        style={{ transformOrigin: "100px 214px",
          animation: isSad ? "trunkDroop 2s ease-in-out infinite alternate" : "none"
        }} />
      {lv >= 0 && <ellipse cx="100" cy="155" rx="46" ry="38" fill={leafFill} opacity={isSad ? 0.72 : 0.92}
        style={{ transformOrigin: "100px 155px", animation: "leafSway 4s ease-in-out infinite" }} />}
      {lv >= 1 && <ellipse cx="100" cy="114" rx="38" ry="30" fill={leafFill} opacity={isSad ? 0.75 : 0.94}
        style={{ transformOrigin: "100px 114px", animation: "leafSway 3.5s ease-in-out infinite 0.3s" }} />}
      {lv >= 2 && <ellipse cx="100" cy="78" rx="29" ry="23" fill={leafFill} opacity="0.9"
        style={{ transformOrigin: "100px 78px", animation: "leafSway 3s ease-in-out infinite 0.6s" }} />}
      {lv >= 3 && <>
        <ellipse cx="100" cy="50" rx="18" ry="15" fill="#fbbf24"
          style={{ animation: "leafSway 2.5s ease-in-out infinite 0.9s" }} />
        <path d="M100,28 L102,36 L110,36 L104,41 L106,49 L100,44 L94,49 L96,41 L90,36 L98,36 Z"
          fill="#fbbf24" style={{ animation: "starPulse 1.5s ease-in-out infinite" }} />
      </>}

      {isHappy && (
        <g opacity="0.95" style={{ animation: "sparkle 1.6s ease-in-out infinite" }}>
          <text x="52" y="88" fontSize="14">✨</text>
          <text x="138" y="72" fontSize="12">✨</text>
          <text x="148" y="128" fontSize="11">🌿</text>
        </g>
      )}
      {state === "Fatigue" && <text x="142" y="96" fontSize="16" style={{ animation: "zzz 1.8s ease-in-out infinite" }}>💤</text>}
      {state === "Anxiety" && <text x="146" y="100" fontSize="14">💦</text>}
      {state === "Boredom" && <text x="44" y="120" fontSize="14" opacity="0.8">🍂</text>}

      <text
        x="100"
        y={faceY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={faceSize}
        style={{ animation: isHappy ? "facePop 2.2s ease-in-out infinite" : "none" }}
      >
        {mood.emoji}
      </text>

      <style>{`
        @keyframes treeBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes treeDroop{0%{transform:translateY(2px) rotate(-1deg)}100%{transform:translateY(6px) rotate(1.5deg)}}
        @keyframes treeShake{0%{transform:rotate(-2.5deg)}100%{transform:rotate(2.5deg)}}
        @keyframes leafSway{0%,100%{transform:rotate(-2deg)scale(1)}50%{transform:rotate(2deg)scale(1.03)}}
        @keyframes trunkDroop{0%{transform:rotate(0)}100%{transform:rotate(3deg)}}
        @keyframes starPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(1.2)}}
        @keyframes sparkle{0%,100%{opacity:0.35;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}
        @keyframes zzz{0%,100%{opacity:0.4;transform:translateY(0)}50%{opacity:1;transform:translateY(-8px)}}
        @keyframes facePop{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
      `}</style>
    </svg>
  );
}
