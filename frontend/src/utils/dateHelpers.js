// Local-timezone "YYYY-MM-DD", unlike Date#toISOString() which converts to
// UTC first — for timezones ahead of UTC (e.g. UTC+5:30) that silently
// shifts every local midnight back a day, misdating whole calendar grids.
export function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysRemaining(isoDate, from = new Date()) {
  const target = new Date(`${isoDate}T00:00:00`);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diffMs = target - today;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDeadlineCopy(isoDate) {
  const days = daysRemaining(isoDate);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

export function formatFriendlyDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function greetingForNow(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Local-midnight Date for the Monday of the week `date` falls in (Monday-start week, matching WEEKDAYS). */
export function getWeekStart(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sunday..6=Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** "Sep 1 - 7" or "Sep 29 - Oct 5" (crossing months) / "Dec 29 - Jan 4" (crossing years). */
export function formatWeekRangeLabel(weekStartDate) {
  const end = addDays(weekStartDate, 6);
  const sameMonth = weekStartDate.getMonth() === end.getMonth() && weekStartDate.getFullYear() === end.getFullYear();
  const startLabel = weekStartDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = sameMonth
    ? String(end.getDate())
    : end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
}
