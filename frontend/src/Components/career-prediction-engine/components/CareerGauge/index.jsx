import './styles.css';

/** Career domains shown as chips under the gauge. */
const DOMAINS = ['Data Science', 'Software Eng', 'UX Research'];

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
 * Circular SVG gauge showing career readiness out of 100.
 * @param {number} score - readiness score, 0-100
 */
export default function CareerGauge({ score }) {
  const hasScore = typeof score === 'number' && !Number.isNaN(score);

  const R = 72;
  const C = 90;
  const circumference = 2 * Math.PI * R;

  // Clamp to 0-100 so a stray value can never overdraw the arc.
  const pct = hasScore ? Math.max(0, Math.min(100, score)) / 100 : 0;
  const stroke = hasScore ? colorForScore(score) : 'var(--cpe-border)';

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

      <div className="cg-chips">
        {DOMAINS.map((d) => (
          <span key={d} className="cg-chip">{d}</span>
        ))}
      </div>
    </section>
  );
}
