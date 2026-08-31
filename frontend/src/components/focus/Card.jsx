import React from "react";

// `hover` opts a card into the lift/shadow interaction — used for tiles that
// represent a thing (a stat, an achievement, a person), not for plain containers.
export default function Card({ children, className = "", style = {}, hover = false, ...rest }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 ${hover ? "fu-lift" : ""} ${className}`}
      style={{
        background: "rgba(255,255,255,0.6)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.10)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
