/** Split a minute total into hours + leftover minutes (matches the backend). */
// VIVA SI: Minutes අගය hours සහ ඉතිරි minutes ලෙස වෙන් කරයි.
export function splitHM(totalMinutes) {
  const total = Math.max(0, Math.round(Number(totalMinutes) || 0));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

// VIVA SI: Hours සහ minutes එකතු කර මුළු minutes ගනී.
export function combineHM(hours, minutes) {
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
}

/** e.g. 83 → "1h 23m", 45 → "45m"; under 1 minute can show seconds. */
// VIVA SI: Time එක තිරයේ කියවන්න ලේසි hours / minutes / seconds ලෙස පෙන්වයි.
export function formatHM(totalMinutes, { allowSeconds = false } = {}) {
  const n = Math.max(0, Number(totalMinutes) || 0);
  if (allowSeconds && n > 0 && n < 1) {
    return `${Math.max(1, Math.round(n * 60))}s`;
  }
  const { hours, minutes } = splitHM(n);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Local calendar date as YYYY-MM-DD (not UTC). */
// VIVA SI: Browser local date එක YYYY-MM-DD ලෙස ගනී.
export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// VIVA SI: දවසක saved focus hours සහ minutes එකතු කරයි.
export function dayFocusMin(day) {
  return combineHM(day?.focus_hours, day?.focus_minutes);
}

// VIVA SI: දවසක saved distraction hours සහ minutes එකතු කරයි.
export function dayDistMin(day) {
  return combineHM(day?.distraction_hours, day?.distraction_minutes);
}

// VIVA SI: දිනයෙන් කෙටි weekday නම ගනී.
export function weekdayShort(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });
}

/** Overlay live today totals onto the weekly payload from the API. */
// VIVA SI: Weekly saved data තුළ අද දවසට live totals දමා chart එක update කරයි.
export function mergeLiveWeek(weekly, focusMin, distMin, today = todayISO()) {
  const days = (weekly?.days || []).map((d) => {
    if (d.date !== today) return d;
    const focus = splitHM(focusMin);
    const dist = splitHM(distMin);
    const tracked = focusMin + distMin;
    return {
      ...d,
      focus_hours: focus.hours,
      focus_minutes: focus.minutes,
      distraction_hours: dist.hours,
      distraction_minutes: dist.minutes,
      focus_score: tracked > 0 ? Math.round((focusMin / tracked) * 100) : 0,
    };
  });
  const totalFocus = days.reduce((s, d) => s + dayFocusMin(d), 0);
  const totalDist = days.reduce((s, d) => s + dayDistMin(d), 0);
  return {
    ...weekly,
    days,
    totalFocus,
    totalDist,
  };
}
