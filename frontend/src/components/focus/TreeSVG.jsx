import React from "react";
import { STATE_CFG, LEVEL_DATA } from "./focusData";

export default function TreeSVG({ state, points, size = 200 }) {
  const cfg = STATE_CFG[state] || STATE_CFG.Focused;
  const lv = LEVEL_DATA.filter((l) => points >= l.min).length - 1;
  const isGolden = lv === 3;
  const leafFill = isGolden ? "#f59e0b" : cfg.color;

  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 200 220"
      style={{
        filter: `drop-shadow(0 0 16px ${cfg.color}44)`,
        animation: state === "Anxiety" ? "treeShake 0.4s ease-in-out infinite alternate" : "treeBob 3s ease-in-out infinite",
      }}>
      <ellipse cx="100" cy="212" rx="36" ry="7" fill={cfg.color} opacity="0.2" />
      <rect x="90" y="150" width="20" height="64" rx="7"
        fill="#8B5E3C"
        style={{ transformOrigin: "100px 214px",
          animation: ["Fatigue","Boredom"].includes(state) ? "trunkDroop 2s ease-in-out infinite alternate" : "none"
        }} />
      {lv >= 0 && <ellipse cx="100" cy="155" rx="44" ry="36" fill={leafFill} opacity="0.9"
        style={{ transformOrigin: "100px 155px", animation: "leafSway 4s ease-in-out infinite" }} />}
      {lv >= 1 && <ellipse cx="100" cy="114" rx="36" ry="28" fill={leafFill} opacity="0.92"
        style={{ transformOrigin: "100px 114px", animation: "leafSway 3.5s ease-in-out infinite 0.3s" }} />}
      {lv >= 2 && <ellipse cx="100" cy="78" rx="27" ry="22" fill={leafFill} opacity="0.88"
        style={{ transformOrigin: "100px 78px", animation: "leafSway 3s ease-in-out infinite 0.6s" }} />}
      {lv >= 3 && <>
        <ellipse cx="100" cy="50" rx="18" ry="15" fill="#fbbf24"
          style={{ animation: "leafSway 2.5s ease-in-out infinite 0.9s" }} />
        <path d="M100,28 L102,36 L110,36 L104,41 L106,49 L100,44 L94,49 L96,41 L90,36 L98,36 Z"
          fill="#fbbf24" style={{ animation: "starPulse 1.5s ease-in-out infinite" }} />
      </>}
      <style>{`
        @keyframes treeBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes treeShake{0%{transform:rotate(-2.5deg)}100%{transform:rotate(2.5deg)}}
        @keyframes leafSway{0%,100%{transform:rotate(-2deg)scale(1)}50%{transform:rotate(2deg)scale(1.03)}}
        @keyframes trunkDroop{0%{transform:rotate(0)}100%{transform:rotate(2.5deg)}}
        @keyframes starPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(1.2)}}
      `}</style>
    </svg>
  );
}
