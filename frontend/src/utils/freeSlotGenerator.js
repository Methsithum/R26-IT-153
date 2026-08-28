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

// Turns the student's real preferred-study-time choice(s) (1 or 2 of
// morning/afternoon/evening/night) plus their max daily study hours into
// real, per-weekday free-time windows sent to /schedule — the actual input
// the ML scheduler time-blocks tasks into, so the setting now genuinely
// drives the generated plan instead of sitting unused next to a fixed mock.
export function buildWeeklyFreeSlots({ preferredStudyTimes, maxDailyStudyHours = 4 }) {
  const chosen = (preferredStudyTimes?.length ? preferredStudyTimes : ["evening"])
    .map((key) => STUDY_TIME_WINDOWS[key])
    .filter(Boolean);
  if (!chosen.length) return [];

  const dailyCapMinutes = Math.max(30, maxDailyStudyHours * 60);
  const perWindowCap = Math.floor(dailyCapMinutes / chosen.length);

  return WEEKDAYS.flatMap((day) =>
    chosen.map((win) => {
      const duration = Math.max(30, Math.min(windowMinutes(win), perWindowCap));
      return {
        day,
        start_time: win.start,
        end_time: addMinutes(win.start, duration),
        duration_minutes: duration,
      };
    })
  );
}
