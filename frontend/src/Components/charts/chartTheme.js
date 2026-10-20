// Every color here is one of this app's existing theme tokens (src/index.css
// @theme block) or an opacity/tint of one. No new hue is introduced for charts.
export const BRAND = {
  50: "#f2ecff",
  100: "#e4d9ff",
  200: "#cbb3ff",
  300: "#ac85ff",
  400: "#8f5cff",
  500: "#7c3aed",
  600: "#6d28d9",
  700: "#5b21b6",
};

export const PINK = "#ec4899"; // --color-accent-pink

export const NEUTRAL = {
  200: "#e2e8f0", // slate-200, gridlines
  300: "#cbd5e1",
  400: "#94a3b8", // slate-400, axis/caption text
  500: "#64748b",
  700: "#334155",
};

// Categorical palette for >2 series: brand + pink + tints/shades of both,
// ordered so adjacent series stay visually distinguishable.
export const CATEGORICAL = [BRAND[500], PINK, BRAND[300], "#f472b6", BRAND[700], "#fbcfe8", BRAND[400]];

export const RADIUS = { card: "1.5rem", chip: "0.75rem" }; // rounded-3xl / rounded-2xl / rounded-xl
export const SHADOW_CARD = "0 4px 14px -4px rgb(23 15 46 / 0.08)";
export const EASE_OUT = [0.16, 1, 0.3, 1]; // matches the app's framer-motion easeOut usage
