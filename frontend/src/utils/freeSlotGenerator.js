import { WEEKDAYS } from "./dateHelpers";

// Real time-of-day windows a "preferred study time" maps to. Kept modest
// and non-overlapping so combining two preferences (e.g. morning + night)
// gives genuinely separate blocks, not a merged mega-window.
export const STUDY_TIME_WINDOWS = {
  morning: { label: "Morning", start: "07:00", end: "11:00" },
  afternoon: { label: "Afternoon", start: "12:00", end: "16:00" },
  evening: { label: "Evening", start: "17:00", end: "20:00" },
  night: { label: "Night", start: "20:30", end: "23:30" },
};

function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function windowMinutes(win) {
  const [sh, sm] = win.start.split(":").map(Number);
  const [eh, em] = win.end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

// A day marked as a "full study day" (Settings' permanent Full Study Days
// picker) gets this single big block INSTEAD OF its normal
// preferredStudyTimes window(s) - not layered on top of them, since 8h
// already dwarfs whatever the regular window would add, and stacking both
// would just be a confusing double-entry for the same day. Daytime hours
// (not starting at midnight, not running past a normal bedtime) so it reads
// as a real study day, not an unrealistic marathon window.
export const FULL_STUDY_DAY_WINDOW = { start: "09:00", end: "17:00" }; // 8h

// Turns the student's real preferred-study-time choice(s) (1 or 2 of
// morning/afternoon/evening/night) plus their max daily study hours into
// real, per-weekday free-time windows sent to /schedule — the actual input
// the ML scheduler time-blocks tasks into, so the setting now genuinely
// drives the generated plan instead of sitting unused next to a fixed mock.
export function buildWeeklyFreeSlots({ preferredStudyTimes, maxDailyStudyHours = 4, includeWeekends = true, fullStudyDays = [] }) {
  const chosen = (preferredStudyTimes?.length ? preferredStudyTimes : ["evening"])
    .map((key) => STUDY_TIME_WINDOWS[key])
    .filter(Boolean);
  if (!chosen.length) return [];

  const dailyCapMinutes = Math.max(30, maxDailyStudyHours * 60);
  const perWindowCap = Math.floor(dailyCapMinutes / chosen.length);

  // includeWeekends=false is the first real source of day-to-day variation
  // this function has ever had - everything else (preferredStudyTimes,
  // maxDailyStudyHours) still applies identically to every included day, no
  // per-weekday granularity beyond "skip Sat/Sun entirely" yet.
  const fullDaySet = new Set(fullStudyDays);
  // A day the student explicitly marked as a full study day stays in,
  // even with weekends switched off elsewhere - picking a specific day is a
  // more deliberate, specific signal than the blanket weekend toggle, so it
  // wins over it rather than being silently dropped.
  const activeDays = includeWeekends
    ? WEEKDAYS
    : WEEKDAYS.filter((d) => fullDaySet.has(d) || (d !== "Saturday" && d !== "Sunday"));

  return activeDays.flatMap((day) => {
    if (fullDaySet.has(day)) {
      return [
        {
          day,
          start_time: FULL_STUDY_DAY_WINDOW.start,
          end_time: FULL_STUDY_DAY_WINDOW.end,
          duration_minutes: windowMinutes(FULL_STUDY_DAY_WINDOW),
        },
      ];
    }
    return chosen.map((win) => {
      const duration = Math.max(30, Math.min(windowMinutes(win), perWindowCap));
      return {
        day,
        start_time: win.start,
        end_time: addMinutes(win.start, duration),
        duration_minutes: duration,
      };
    });
  });
}
