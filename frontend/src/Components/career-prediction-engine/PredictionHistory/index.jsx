import './styles.css';

/** Risk level ordered by severity, so we can tell improvement from decline. */
const RISK_RANK = { Low: 0, Medium: 1, High: 2 };

/** Badge modifier per risk level. */
const RISK_CLASS = {
  Low: 'ph-badge-low',
  Medium: 'ph-badge-med',
  High: 'ph-badge-high',
};

/**
 * Strip the time off a stored date string ("26 Aug 2026 14:32" -> "26 Aug 2026").
 * @param {string} date
 * @returns {string}
 */
function dayOnly(date) {
  return String(date ?? '').split(' ').slice(0, 3).join(' ');
}

/**
 * Build the trend messages shown under the comparison.
 *
 * Career score and risk level are reported separately because they can move
 * in opposite directions - a student can gain readiness while their risk
 * also rises.
 *
 * @param {object} current - newest prediction
 * @param {object} previous - the one before it
 * @returns {{tone:string, text:string}[]}
 */
function buildTrendMessages(current, previous) {
  const messages = [];

  const delta = current.career_score - previous.career_score;
  const rounded = Math.abs(delta).toFixed(1);

  if (delta > 0) {
    messages.push({
      tone: 'good',
      text: `Your career readiness improved by ${rounded} points since your last prediction. Keep it up!`,
    });
  } else if (delta < 0) {
    messages.push({
      tone: 'warn',
      text: `Your career readiness dropped by ${rounded} points. Check the advisor insights for guidance.`,
    });
  }

  const now = RISK_RANK[current.academic_risk];
  const before = RISK_RANK[previous.academic_risk];

  // A lower rank is a lower risk, so a decrease is an improvement.
  if (now < before) {
    messages.push({
      tone: 'good',
      text: 'Your academic risk level improved! Your efforts are showing results.',
    });
  } else if (now > before) {
    messages.push({
      tone: 'bad',
      text: 'Your academic risk increased. Consider speaking to your academic advisor.',
    });
  }

  return messages;
}

/**
 * Progress panel comparing the two most recent predictions and listing the
 * stored history.
 *
 * Renders nothing unless at least two predictions exist, since there is no
 * progress to show from a single data point.
 *
 * @param {object[]} history - stored predictions, newest first
 */
export default function PredictionHistory({ history }) {
  if (!Array.isArray(history) || history.length < 2) return null;

  const [current, previous] = history;

  const scoreDelta = current.career_score - previous.career_score;
  const riskNow = RISK_RANK[current.academic_risk];
  const riskBefore = RISK_RANK[previous.academic_risk];
  const riskImproved = riskNow < riskBefore;
  const riskChanged = riskNow !== riskBefore;

  const messages = buildTrendMessages(current, previous);

  return (
    <section className="cpe-panel ph">
      <h2 className="cpe-panel-title">Your Progress Over Time</h2>

      {/* Section 1 - latest vs previous */}
      <div className="ph-compare">
        <article className="ph-card">
          <span className="ph-card-tag">Previous</span>
          <span className="ph-card-date">{dayOnly(previous.date)}</span>
          <span className={`ph-badge ${RISK_CLASS[previous.academic_risk] ?? ''}`}>
            {previous.academic_risk}
          </span>
          <span className="ph-card-score">{previous.career_score?.toFixed(1)}</span>
          <span className="ph-card-unit">career readiness</span>
        </article>

        <div className="ph-deltas">
          <div className="ph-delta-row">
            <span className="ph-delta-label">Academic Risk</span>
            <span className="ph-delta-move">
              {previous.academic_risk} → {current.academic_risk}
            </span>
            <span
              className={
                !riskChanged ? 'ph-delta-flat' : riskImproved ? 'ph-delta-up' : 'ph-delta-down'
              }
            >
              {!riskChanged ? '→ No change' : riskImproved ? '↑ Improved' : '↓ Worsened'}
            </span>
          </div>

          <div className="ph-delta-row">
            <span className="ph-delta-label">Career Score</span>
            <span className="ph-delta-move">
              {previous.career_score?.toFixed(1)} → {current.career_score?.toFixed(1)}
            </span>
            <span
              className={
                scoreDelta === 0
                  ? 'ph-delta-flat'
                  : scoreDelta > 0
                    ? 'ph-delta-up'
                    : 'ph-delta-down'
              }
            >
              {scoreDelta === 0
                ? '→ No change'
                : `${scoreDelta > 0 ? '↑ +' : '↓ -'}${Math.abs(scoreDelta).toFixed(1)} points`}
            </span>
          </div>
        </div>

        <article className="ph-card ph-card-current">
          <span className="ph-card-tag">Current</span>
          <span className="ph-card-date">{dayOnly(current.date)}</span>
          <span className={`ph-badge ${RISK_CLASS[current.academic_risk] ?? ''}`}>
            {current.academic_risk}
          </span>
          <span className="ph-card-score">{current.career_score?.toFixed(1)}</span>
          <span className="ph-card-unit">career readiness</span>
        </article>
      </div>

      {/* Section 2 - history timeline */}
      <h3 className="ph-sub">History</h3>
      <div className="ph-table-wrap">
        <table className="ph-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Date</th>
              <th>Risk</th>
              <th>Score</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry, i) => {
              // Compare against the next item, which is the older prediction.
              const older = history[i + 1];
              const diff = older ? entry.career_score - older.career_score : null;

              return (
                <tr key={entry.id}>
                  <td>{i + 1}</td>
                  <td>{dayOnly(entry.date)}</td>
                  <td>
                    <span className={`ph-badge ${RISK_CLASS[entry.academic_risk] ?? ''}`}>
                      {entry.academic_risk}
                    </span>
                  </td>
                  <td>{entry.career_score?.toFixed(1)}</td>
                  <td
                    className={
                      diff === null
                        ? 'ph-delta-flat'
                        : diff > 0
                          ? 'ph-delta-up'
                          : diff < 0
                            ? 'ph-delta-down'
                            : 'ph-delta-flat'
                    }
                  >
                    {diff === null
                      ? '—'
                      : diff === 0
                        ? '—'
                        : `${diff > 0 ? '↑ +' : '↓ -'}${Math.abs(diff).toFixed(1)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Section 3 - trend messages */}
      {messages.length > 0 && (
        <div className="ph-messages">
          {messages.map((m, i) => (
            <p key={i} className={`ph-msg ph-msg-${m.tone}`}>
              {m.text}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
