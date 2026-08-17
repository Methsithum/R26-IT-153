const CAMPUS_TZ = "Asia/Colombo";

export function localTodayIso(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
