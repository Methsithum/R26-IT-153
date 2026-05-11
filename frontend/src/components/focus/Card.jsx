import React from "react";

export default function Card({ children, className = "", style = {} }) {
  return (
    <div className={`rounded-2xl border border-slate-200 ${className}`} style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", ...style }}>
      {children}
    </div>
  );
}
