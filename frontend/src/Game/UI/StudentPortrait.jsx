import { useId } from "react";

export default function StudentPortrait({ className = "", animated = false }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 180 200" role="img" aria-label="Campus explorer" className={`${animated ? "campus-avatar-idle" : ""} ${className}`}>
      <defs><linearGradient id={id} x2="0" y2="1"><stop stopColor="#a78bfa" /><stop offset="1" stopColor="#5b21b6" /></linearGradient></defs>
      <ellipse cx="90" cy="185" rx="55" ry="9" fill="#000" opacity=".18" />
      <rect x="39" y="100" width="102" height="68" rx="25" fill="#d4a44c" />
      <path d="M50 181v-53q0-30 40-30t40 30v53" fill={`url(#${id})`} />
      <path d="M70 107l20 23 20-23" fill="#fff7ed" />
      <rect x="79" y="83" width="22" height="28" rx="8" fill="#cb916b" />
      <ellipse cx="90" cy="65" rx="35" ry="40" fill="#e4ad83" />
      <path d="M54 64q-8-47 37-47 43 0 37 48l-12-26q-18 20-50 11l-9 20" fill="#29233a" />
      <path d="M74 70h3m26 0h3" stroke="#29233a" strokeWidth="5" strokeLinecap="round" />
      <path d="M81 86q9 7 18 0" fill="none" stroke="#854d3c" strokeWidth="3" strokeLinecap="round" />
      <path d="M61 117v54m58-54v54" stroke="#d4a44c" strokeWidth="7" />
      <rect x="77" y="139" width="26" height="31" rx="4" fill="#fff7ed" transform="rotate(-8 90 150)" />
      <path d="M84 149h12m-12 6h9" stroke="#7c3aed" strokeWidth="2" />
    </svg>
  );
}
