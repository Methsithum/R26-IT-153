// Deterministic synthetic dataset for the Analytics "DEMO DATA" toggle.
// Fixed seed -> same output every time; never sent anywhere, never stored
// (it only ever lives in this module's return value, recomputed on demand).

function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260101;

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekStartOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekday = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - weekday);
  return isoDate(d);
}

export function buildDemoLearningPatterns(windowDays = 30) {
  const rand = mulberry32(SEED);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daily = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const skip = rand() < 0.12; // occasional missed day
    if (skip) continue;
    const minutes = Math.round(40 + rand() * 120);
    const xp = Math.round(40 + rand() * 60);
    const engagementRoll = rand();
    const engagementScore = engagementRoll < 0.33 ? 1 : engagementRoll < 0.7 ? 2 : 3;
    const subjects = ["Databases", "Algorithms", "Networks", "Operating Systems"];
    const subject = subjects[Math.floor(rand() * subjects.length)];
    const isCatchup = rand() < 0.15;
    daily.push({
      date: isoDate(day),
      study_minutes: minutes,
      xp,
      sessions: 1,
      engagement_score: engagementScore,
      subjects: [subject],
      timing: isCatchup ? "catch_up" : "on_time",
    });
  }

  const weekdayJournals = new Array(7).fill(0);
  const weekdayMinutes = new Array(7).fill(0);
  for (const d of daily) {
    const wd = (new Date(`${d.date}T00:00:00`).getDay() + 6) % 7;
    weekdayJournals[wd] += d.sessions;
    weekdayMinutes[wd] += d.study_minutes;
  }

  const subjectTotals = {};
  for (const d of daily) {
    const subj = d.subjects[0];
    subjectTotals[subj] = subjectTotals[subj] || { subject: subj, minutes: 0, journals: 0 };
    subjectTotals[subj].minutes += d.study_minutes;
    subjectTotals[subj].journals += 1;
  }

  const calendarCells = [];
  const byDate = Object.fromEntries(daily.map((d) => [d.date, d.timing]));
  for (let i = windowDays - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const key = isoDate(day);
    calendarCells.push({ date: key, status: byDate[key] || "none" });
  }

  const weeklyBuckets = {};
  for (const d of daily) {
    const wk = weekStartOf(d.date);
    weeklyBuckets[wk] = weeklyBuckets[wk] || { week_start: wk, total_minutes: 0, total_xp: 0, active_days: 0, journals: 0 };
    weeklyBuckets[wk].total_minutes += d.study_minutes;
    weeklyBuckets[wk].total_xp += d.xp;
    weeklyBuckets[wk].active_days += 1;
    weeklyBuckets[wk].journals += d.sessions;
  }
  const weeklyAggregates = Object.values(weeklyBuckets).sort((a, b) => (a.week_start < b.week_start ? -1 : 1));

  const engagementPerWeekBuckets = {};
  for (const d of daily) {
    const wk = weekStartOf(d.date);
    engagementPerWeekBuckets[wk] = engagementPerWeekBuckets[wk] || { week_start: wk, low: 0, medium: 0, high: 0 };
    if (d.engagement_score === 1) engagementPerWeekBuckets[wk].low += 1;
    else if (d.engagement_score === 2) engagementPerWeekBuckets[wk].medium += 1;
    else if (d.engagement_score === 3) engagementPerWeekBuckets[wk].high += 1;
  }
  const engagementPerWeek = Object.values(engagementPerWeekBuckets).sort((a, b) => (a.week_start < b.week_start ? -1 : 1));

  return {
    window_days: windowDays,
    daily_series: daily,
    weekly_aggregates: weeklyAggregates,
    weekday_distribution: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      journals: weekdayJournals,
      minutes: weekdayMinutes,
      entropy_bits: 2.4,
      normalized_entropy: 0.86,
    },
    trends: {
      study_minutes: { slope_per_day: 0.8, label: "increasing", mann_kendall: { s: 12, z: 2.1, p: 0.03, threshold_z: 1.96 } },
      xp: { slope_per_day: 0.3, label: "no significant trend (not enough evidence)", mann_kendall: { s: 4, z: 0.6, p: 0.5, threshold_z: 1.96 } },
    },
    anomalies: { items: [], min_active_days_required: 10, eligible: daily.length >= 10 },
    minutes_histogram: (() => {
      const counts = [0, 0, 0, 0, 0, 0];
      const edges = [0, 30, 60, 90, 120, 180, Infinity];
      for (const d of daily) {
        for (let i = 0; i < edges.length - 1; i++) {
          if (d.study_minutes >= edges[i] && d.study_minutes < edges[i + 1]) {
            counts[i] += 1;
            break;
          }
        }
      }
      return { bin_labels: ["0-30", "30-60", "60-90", "90-120", "120-180", "180+"], counts };
    })(),
    engagement_distribution: {
      counts: {
        low: daily.filter((d) => d.engagement_score === 1).length,
        medium: daily.filter((d) => d.engagement_score === 2).length,
        high: daily.filter((d) => d.engagement_score === 3).length,
      },
      per_week: engagementPerWeek,
      any_recorded: true,
      entropy_bits: 1.5,
      normalized_entropy: 0.92,
    },
    subject_effort: {
      sorted_by: "minutes",
      rows: Object.values(subjectTotals).sort((a, b) => b.minutes - a.minutes),
      entropy_bits: 1.9,
      normalized_entropy: 0.88,
    },
    scatter: {
      points: daily.map((d) => ({ study_minutes: d.study_minutes, xp: d.xp, date: d.date })),
      correlation: { rho: 0.62, n: daily.length, p: 0.01, reason: null },
    },
    calendar: { cells: calendarCells, current_streak: 3, longest_streak: 7 },
    hour_of_day: {
      counts: Array.from({ length: 24 }, (_, h) => (h >= 18 && h <= 22 ? Math.round(rand() * 5) + 2 : Math.round(rand() * 2))),
      timezone: "Asia/Colombo",
      based_on: "synthetic demo data",
    },
    recordedness: { study_minutes_recorded_share: 1, engagement_recorded_share: 1, subjects_recorded_share: 1 },
    meta: {
      n_sessions: daily.length,
      n_active_days: daily.length,
      window_days: windowDays,
      generated_at: new Date().toISOString(),
      xp_note: "Synthetic demo data - not your real journal activity.",
    },
  };
}

export function buildDemoBehaviorLatest() {
  return {
    available: true,
    behaviorCategory: "Consistent Learner",
    reasoning: "This is a synthetic example reasoning string shown only while Demo Data is on.",
    created_at: new Date().toISOString(),
    generated_at: new Date().toISOString(),
    demo: true,
    snapshotOfActivityData: {
      account_age_days: 21,
      observation_window_days: 14,
      study_hours_avg_per_day: 1.4,
      study_hours_last_14_days: 9.8,
      total_sessions_last_14_days: 7,
      activity_frequency: 0.5,
      assignment_progress: { in_progress: 2, completed: 3 },
      deadline_proximity: { nearest_deadline_days: 4, due_within_3_days: 0, due_within_7_days: 2, overdue: 0 },
      task_completion_history: { total_tasks: 6, completed_tasks: 3 },
      engagement_trend: "stable",
      engagement_distribution: { high: 4, medium: 2, low: 1 },
      last_activity_date: new Date().toISOString(),
    },
  };
}
