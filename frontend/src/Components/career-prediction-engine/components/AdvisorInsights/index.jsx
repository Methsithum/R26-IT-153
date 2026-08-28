import './styles.css';

/**
 * Build the sleep insight from the student's average sleep hours.
 * Thresholds follow common guidance for young adults (7-9 hrs).
 */
function sleepInsight(sleep) {
  if (sleep == null) return 'No sleep data available for this student.';
  if (sleep < 6) {
    return `Averaging ${sleep.toFixed(1)} hrs of sleep is well below the 7-9 hr range. Sleep debt this large measurably degrades memory consolidation and raises academic risk.`;
  }
  if (sleep < 7) {
    return `At ${sleep.toFixed(1)} hrs, sleep is slightly short of the recommended 7-9 hrs. Adding 30-60 min per night is a low-effort way to lift retention.`;
  }
  return `Sleep is healthy at ${sleep.toFixed(1)} hrs per night, sitting inside the recommended 7-9 hr range. Maintaining this protects focus and mood.`;
}

/**
 * Build the study insight from weekly study hours.
 */
function studyInsight(hours) {
  if (hours == null) return 'No study-hour data available for this student.';
  if (hours < 10) {
    return `Only ${hours.toFixed(0)} study hrs/week is below what most modules require. Raising this toward 15-20 hrs is the single highest-leverage change available.`;
  }
  if (hours < 18) {
    return `${hours.toFixed(0)} study hrs/week is workable but leaves little margin. Pushing toward 20 hrs would build a buffer before assessment periods.`;
  }
  return `A strong ${hours.toFixed(0)} study hrs/week. Focus now shifts from quantity to quality - spaced repetition over re-reading.`;
}

/**
 * Build the stress insight from the 0-100 stress level.
 */
function stressInsight(stress) {
  if (stress == null) return 'No stress data available for this student.';
  if (stress >= 70) {
    return `Stress is high at ${stress.toFixed(0)}/100. At this level stress becomes the limiting factor on performance - counselling or workload triage should come before study-hour increases.`;
  }
  if (stress >= 45) {
    return `Moderate stress at ${stress.toFixed(0)}/100. Manageable for now, but worth monitoring through assessment periods when it typically spikes.`;
  }
  return `Stress is well controlled at ${stress.toFixed(0)}/100, leaving healthy capacity to absorb heavier workloads.`;
}

/**
 * Three colour-coded advisor cards whose copy adapts to the student's values.
 *
 * @param {number} career_score - predicted career readiness, used in the summary
 * @param {number} stress       - stress_level, 0-100
 * @param {number} sleep        - sleep_hours_avg
 * @param {number} study_hours  - weekly_study_hours
 */
export default function AdvisorInsights({ career_score, stress, sleep, study_hours }) {
  const cards = [
    { key: 'sleep', tone: 'blue', title: 'Sleep & Recovery', body: sleepInsight(sleep) },
    { key: 'study', tone: 'orange', title: 'Study Commitment', body: studyInsight(study_hours) },
    { key: 'stress', tone: 'red', title: 'Stress Load', body: stressInsight(stress) },
  ];

  return (
    <section className="cpe-panel ai">
      <div className="ai-head">
        <h2 className="cpe-panel-title" style={{ margin: 0 }}>Advisor Insights</h2>
        {typeof career_score === 'number' && (
          <span className="ai-score">
            Career readiness {career_score.toFixed(1)}/100
          </span>
        )}
      </div>

      <div className="ai-grid">
        {cards.map(({ key, tone, title, body }) => (
          <article key={key} className={`ai-card ai-card-${tone}`}>
            <h3 className="ai-card-title">{title}</h3>
            <p className="ai-card-body">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
