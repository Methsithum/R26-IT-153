import './styles.css';

/**
 * Feature display config, grouped by domain.
 *
 * `good` decides the dot colour: it receives the raw value and returns true
 * when the value is healthy (green dot) or false when it needs attention
 * (orange dot). `fmt` renders the value in a human-readable unit.
 */
const GROUPS = [
  {
    title: 'Academic',
    items: [
      { key: 'gpa_cumulative', label: 'Cumulative GPA', fmt: (v) => v.toFixed(2), good: (v) => v >= 3.0 },
      { key: 'gpa_trend', label: 'GPA Trend', fmt: (v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)), good: (v) => v >= 0 },
      { key: 'assignment_completion_rate', label: 'Assignment Completion', fmt: (v) => `${Math.round(v * 100)}%`, good: (v) => v >= 0.8 },
      { key: 'late_submission_rate', label: 'Late Submissions', fmt: (v) => `${Math.round(v * 100)}%`, good: (v) => v <= 0.2 },
      { key: 'resit_count', label: 'Resit Count', fmt: (v) => String(Math.round(v)), good: (v) => v === 0 },
      { key: 'project_performance', label: 'Project Performance', fmt: (v) => `${v.toFixed(0)}/100`, good: (v) => v >= 70 },
    ],
  },
  {
    title: 'Behavioral',
    items: [
      { key: 'attendance_rate', label: 'Attendance', fmt: (v) => `${Math.round(v * 100)}%`, good: (v) => v >= 0.8 },
      { key: 'weekly_study_hours', label: 'Study Hours / Week', fmt: (v) => `${v.toFixed(0)} hrs`, good: (v) => v >= 15 },
      { key: 'sleep_hours_avg', label: 'Avg Sleep', fmt: (v) => `${v.toFixed(1)} hrs`, good: (v) => v >= 6.5 },
      { key: 'sleep_consistency', label: 'Sleep Consistency', fmt: (v) => v.toFixed(2), good: (v) => v >= 0.7 },
      { key: 'part_time_work_hours', label: 'Part-Time Work', fmt: (v) => `${v.toFixed(0)} hrs`, good: (v) => v <= 15 },
    ],
  },
  {
    title: 'Emotional',
    items: [
      { key: 'stress_level', label: 'Stress Level', fmt: (v) => `${v.toFixed(0)}/100`, good: (v) => v <= 50 },
      { key: 'anxiety_score', label: 'Anxiety Score', fmt: (v) => `${v.toFixed(0)}/25`, good: (v) => v <= 12 },
      { key: 'mood_stability', label: 'Mood Stability', fmt: (v) => `${v.toFixed(0)}/100`, good: (v) => v >= 55 },
    ],
  },
  {
    title: 'Career',
    items: [
      { key: 'career_clarity_score', label: 'Career Clarity', fmt: (v) => `${v.toFixed(0)}/100`, good: (v) => v >= 60 },
    ],
  },
];

/**
 * Read-only view of a student's 15 features, grouped by domain, with a
 * green/orange status dot per feature.
 *
 * @param {object} features - the 15 feature values keyed by feature name
 */
export default function InputDataPanel({ features }) {
  // Nothing to show until the parent has loaded a student.
  if (!features) {
    return (
      <section className="cpe-panel">
        <h2 className="cpe-panel-title">Input Data</h2>
        <p className="cpe-placeholder">No student loaded.</p>
      </section>
    );
  }

  return (
    <section className="cpe-panel idp">
      <h2 className="cpe-panel-title">Input Data</h2>

      <div className="idp-scroll">
        {GROUPS.map(({ title, items }) => (
          <div key={title} className="idp-group">
            <div className="idp-group-title">{title}</div>

            {items.map(({ key, label, fmt, good }) => {
              const raw = features[key];
              // Guard against a missing/non-numeric field from the API.
              if (typeof raw !== 'number' || Number.isNaN(raw)) return null;

              const isGood = good(raw);
              return (
                <div key={key} className="idp-row">
                  <span
                    className={`idp-dot ${isGood ? 'idp-dot-good' : 'idp-dot-warn'}`}
                    title={isGood ? 'Good' : 'Needs attention'}
                  />
                  <span className="idp-label">{label}</span>
                  <span className="idp-value">{fmt(raw)}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
