import { getCareerRecommendations } from '../../../../utils/careerRecommendations';
import { explainCareerScore } from '../../../../utils/predictionExplain';
import './styles.css';

/**
 * Pick the arc colour from the score band.
 * Green above 70, blue 50-70, red below 50.
 */
function colorForScore(score) {
  if (score > 70) return 'var(--cpe-green)';
  if (score >= 50) return 'var(--cpe-blue)';
  return 'var(--cpe-red)';
}

/**
 * Circular SVG gauge showing career readiness out of 100, plus the top 3
 * career domain matches computed from the student's feature values.
 * @param {number} score - readiness score, 0-100
 * @param {object} studentData - the 15 model features
 */
export default function CareerGauge({ score, studentData }) {
  const hasScore = typeof score === 'number' && !Number.isNaN(score);

  const R = 72;
  const C = 90;
  const circumference = 2 * Math.PI * R;

  // Clamp to 0-100 so a stray value can never overdraw the arc.
  const pct = hasScore ? Math.max(0, Math.min(100, score)) / 100 : 0;
  const stroke = hasScore ? colorForScore(score) : 'var(--cpe-border)';

  const recommendations = studentData ? getCareerRecommendations(studentData) : [];
  const { topDrivers, summary } = explainCareerScore(studentData);

  return (
    <section className="cpe-panel cg">
      <h2 className="cpe-panel-title">Career Readiness</h2>

      <div className="cg-gauge">
        <svg viewBox="0 0 180 180" className="cg-svg" role="img"
             aria-label={hasScore ? `Career readiness ${score.toFixed(1)} out of 100` : 'No score yet'}>
          {/* Track */}
          <circle cx={C} cy={C} r={R} fill="none" stroke="var(--cpe-bg-panel-alt)" strokeWidth="14" />
          {/* Progress arc, rotated so it starts at 12 o'clock */}
          <circle
            cx={C}
            cy={C}
            r={R}
            fill="none"
            stroke={stroke}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${circumference * pct} ${circumference}`}
            transform={`rotate(-90 ${C} ${C})`}
            className="cg-arc"
          />
          <text x={C} y={C - 2} textAnchor="middle" className="cg-num" fill="var(--cpe-text)">
            {hasScore ? score.toFixed(1) : '—'}
          </text>
          <text x={C} y={C + 20} textAnchor="middle" className="cg-unit" fill="var(--cpe-text-faint)">
            out of 100
          </text>
        </svg>
      </div>

      <div className="career-chips-row">
        {recommendations.map((c) => (
          <span key={c.label} className="career-chip">
            <span>{c.icon}</span>
            <span>{c.label}</span>
            <span className="career-chip-match">{c.match}%</span>
          </span>
        ))}
      </div>

      {topDrivers.length > 0 && (
        <details className="cg-explain">
          <summary>How is this calculated?</summary>
          <p className="cg-explain-summary">{summary}</p>
          <ul className="cg-explain-list">
            {topDrivers.map((d) => (
              <li key={d.label}>
                <span>{d.label}</span>
                <span className="cg-explain-bar">
                  <span
                    className="cg-explain-bar-fill"
                    style={{ width: `${Math.max(0, Math.min(100, (d.contribution / 20) * 100))}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
