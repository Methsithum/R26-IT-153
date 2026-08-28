const CAMPUS_TZ = "Asia/Colombo";

export function localTodayIso(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Format a YYYY-MM-DD campus date without UTC timezone shift. */
export function formatCampusDate(iso, options) {
  const key = String(iso || "").slice(0, 10);
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  return new Date(year, month - 1, day).toLocaleDateString(
    undefined,
    options || { weekday: "long", month: "long", day: "numeric" }
  );
}

export function isPastCampusDate(iso) {
  const key = String(iso || "").slice(0, 10);
  return Boolean(key) && key < localTodayIso();
}

export function campusDateKey(value) {
  return String(value || "").slice(0, 10);
}
