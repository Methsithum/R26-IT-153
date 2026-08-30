import { explainAcademicRisk } from '../../../../utils/predictionExplain';
import './styles.css';

/** Colour + copy per risk level. */
const RISK_META = {
  Low: {
    color: 'var(--cpe-green)',
    text: 'On track. Academic indicators are healthy across all domains.',
  },
  Medium: {
    color: 'var(--cpe-orange)',
    text: 'Some warning signs. Targeted support could prevent decline.',
  },
  High: {
    color: 'var(--cpe-red)',
    text: 'Significant risk detected. Immediate intervention recommended.',
  },
};

/**
 * Academic risk display: level, gradient severity bar with arrow, and the
 * three class probabilities.
 *
 * @param {string} risk_level - "Low" | "Medium" | "High"
 * @param {number} [risk_score] - 0-100 severity; derived from probabilities when absent
 * @param {number} prob_low - probability of Low, as a percentage (0-100)
 * @param {number} prob_medium - probability of Medium, as a percentage
 * @param {number} prob_high - probability of High, as a percentage
 * @param {object} [studentData] - the 15 raw feature values, for the explanation panel
 */
export default function RiskPanel({
  risk_level,
  risk_score,
  prob_low,
  prob_medium,
  prob_high,
  studentData,
}) {
  if (!risk_level) {
    return (
      <section className="cpe-panel">
        <h2 className="cpe-panel-title">Academic Risk</h2>
        <p className="cpe-placeholder">Run a prediction to see risk.</p>
      </section>
    );
  }

  const meta = RISK_META[risk_level] ?? { color: 'var(--cpe-text-dim)', text: '' };

  // The API returns no single severity number, so build one from the class
  // probabilities: Low contributes 0, Medium 50, High 100.
  const derived =
    ((prob_low ?? 0) * 0 + (prob_medium ?? 0) * 50 + (prob_high ?? 0) * 100) / 100;
  const severity = Math.max(
    0,
    Math.min(100, typeof risk_score === 'number' ? risk_score : derived),
  );

  const bars = [
    { label: 'Low', value: prob_low ?? 0, color: 'var(--cpe-green)' },
    { label: 'Medium', value: prob_medium ?? 0, color: 'var(--cpe-orange)' },
    { label: 'High', value: prob_high ?? 0, color: 'var(--cpe-red)' },
  ];

  const { flags, summary: riskSummary } = explainAcademicRisk(studentData);

  return (
    <section className="cpe-panel rp">
      <h2 className="cpe-panel-title">Academic Risk</h2>

      <div className="rp-level" style={{ color: meta.color }}>
        {risk_level}
      </div>

      {/* Gradient severity bar with a positioned arrow marker. */}
      <div className="rp-track">
        <div className="rp-arrow" style={{ left: `${severity}%` }} aria-hidden="true">
          ▼
        </div>
        <div className="rp-gradient" />
        <div className="rp-scale">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      <div className="rp-probs">
        {bars.map(({ label, value, color }) => (
          <div key={label} className="rp-prob">
            <div className="rp-prob-head">
              <span className="rp-prob-label">{label}</span>
              <span className="rp-prob-val">{value.toFixed(1)}%</span>
            </div>
            <div className="rp-prob-track">
              <div
                className="rp-prob-fill"
                style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="rp-desc">{meta.text}</p>

      {studentData && (
        <details className="rp-explain">
          <summary>How is this calculated?</summary>
          <p className="rp-explain-summary">{riskSummary}</p>
          {flags.length > 0 && (
            <ul className="rp-explain-list">
              {flags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          )}
        </details>
      )}
    </section>
  );
}
