import { useMemo } from "react";
import { Lightbulb, Clock3, CalendarClock, Coffee } from "lucide-react";
import { buildWeeklyFreeSlots } from "../../../utils/freeSlotGenerator";
import { daysRemaining } from "../../../utils/dateHelpers";

/**
 * Right-rail tips on the Settings page - every number here is computed from
 * the student's REAL current assignments/settings (never generic filler
 * text), so a recommendation always has a concrete "why" attached - same
 * honesty-about-real-data principle the rest of the app already follows
 * (PROJECT CONTEXT.md's "never show a fabricated number as if it were
 * real"). Recomputes live as the student adjusts preferences below, so the
 * numbers on this panel always reflect what they're currently looking at,
 * not what they had before they started changing things.
 */
export default function SettingsRecommendations({ settings, assignments }) {
  const { studyPreferences } = settings;

  const weeklyFreeHours = useMemo(() => {
    const slots = buildWeeklyFreeSlots(studyPreferences);
    return slots.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60;
  }, [studyPreferences]);

  const pending = useMemo(() => assignments.filter((a) => a.status === "pending"), [assignments]);

  const remainingHours = useMemo(
    () => pending.reduce((sum, a) => sum + Math.max(0, (a.estimatedHoursNeeded || 0) - (a.completedHours || 0)), 0),
    [pending]
  );

  // How many weeks of runway the busiest pending task actually gives us -
  // the real denominator for "is weeklyFreeHours actually enough", not an
  // arbitrary constant. Defaults to 1 week when nothing's pending yet, so
  // the panel never divides by zero or shows a misleadingly huge number.
  const weeksOfRunway = useMemo(() => {
    if (!pending.length) return 1;
    const farthestDays = Math.max(...pending.map((a) => daysRemaining(a.deadlineDate)));
    return Math.max(1, Math.ceil((farthestDays + 1) / 7));
  }, [pending]);

  const neededHoursPerWeek = remainingHours / weeksOfRunway;
  const isShortOnCapacity = pending.length > 0 && neededHoursPerWeek > weeklyFreeHours;
  const selectedTimesCount = (studyPreferences.preferredStudyTimes || []).length;

  const tips = [];

  if (isShortOnCapacity) {
    tips.push({
      icon: CalendarClock,
      text: `Your ${pending.length} pending task${pending.length === 1 ? "" : "s"} need about ${neededHoursPerWeek.toFixed(1)}h/week to finish on time, but your current settings only free up ${weeklyFreeHours.toFixed(1)}h/week — consider raising Max Daily Study Hours or adding a second preferred time.`,
    });
  } else if (pending.length > 0) {
    tips.push({
      icon: CalendarClock,
      text: `Your ${weeklyFreeHours.toFixed(1)}h/week of free time comfortably covers the ~${neededHoursPerWeek.toFixed(1)}h/week your pending work needs.`,
    });
  }

  if (selectedTimesCount === 1) {
    tips.push({
      icon: Clock3,
      text: "You've only picked one preferred time window. Adding a second gives the scheduler more slots to spread work across busier weeks — especially useful as exams get closer.",
    });
  }

  if (studyPreferences.breakDurationMinutes <= 5) {
    tips.push({
      icon: Coffee,
      text: "A 5-minute break is quite short between study blocks — most students find 10-15 minutes enough to actually reset focus without losing momentum.",
    });
  } else if (studyPreferences.breakDurationMinutes >= 30 && studyPreferences.maxDailyStudyHours <= 3) {
    tips.push({
      icon: Coffee,
      text: "With only a few study hours available per day, a 30-minute break eats into a large share of that time — a shorter break would leave more of your limited window for actual studying.",
    });
  }

  return (
    <div className="card p-5 lg:sticky lg:top-5">
      <div className="flex items-center gap-2 mb-1">
        <Lightbulb size={16} className="text-medium-500" />
        <p className="font-display font-bold text-slate-800 dark:text-white">Recommendations</p>
      </div>
      <p className="text-xs text-slate-400 mb-4">Based on your real pending work and current preferences.</p>

      {tips.length === 0 ? (
        <p className="text-sm text-slate-400">
          Nothing to flag right now — your preferences look well-matched to your current workload.
        </p>
      ) : (
        <div className="space-y-3">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-2xl bg-medium-50 dark:bg-medium-500/10 p-3">
              <tip.icon size={15} className="text-medium-600 dark:text-medium-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{tip.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
