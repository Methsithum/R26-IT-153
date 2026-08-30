import './styles.css';

/** Risk level -> colour, for the before/after risk row. */
const RISK_COLOR = {
  Low: 'var(--cpe-green)',
  Medium: 'var(--cpe-orange)',
  High: 'var(--cpe-red)',
};

/** Severity ranking so we can tell whether risk improved or worsened. */
const RISK_RANK = { Low: 0, Medium: 1, High: 2 };

/**
 * Side-by-side comparison of the original prediction and the simulated one.
 *
 * @param {object} before - prediction object before simulation
 * @param {object} after  - prediction object after simulation
 */
export default function BeforeAfterPanel({ before, after }) {
  // Empty state until a simulation has been run.
  if (!before || !after) {
    return (
      <section className="cpe-panel">
        <h2 className="cpe-panel-title">Before / After</h2>
        <p className="cpe-placeholder">Run simulation to see changes</p>
      </section>
    );
  }

  const scoreDelta = after.career_score - before.career_score;
  const scoreUp = scoreDelta > 0;

  const rankBefore = RISK_RANK[before.academic_risk];
  const rankAfter = RISK_RANK[after.academic_risk];
  const riskChanged = before.academic_risk !== after.academic_risk;
  // A lower rank means less risk, which is an improvement.
  const riskImproved = rankAfter < rankBefore;

  return (
    <section className="cpe-panel bap">
      <h2 className="cpe-panel-title">Before / After</h2>

      {/* Career readiness */}
      <div className="bap-metric">
        <span className="bap-metric-name">Career Readiness</span>
        <div className="bap-metric-row">
          <span className="bap-old">{before.career_score.toFixed(1)}</span>
          <span className="bap-arrow">→</span>
          <span className="bap-new">{after.career_score.toFixed(1)}</span>
          <span
            className="bap-delta"
            style={{ color: scoreUp ? 'var(--cpe-green)' : scoreDelta < 0 ? 'var(--cpe-red)' : 'var(--cpe-text-faint)' }}
          >
            {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Risk level */}
      <div className="bap-metric">
        <span className="bap-metric-name">Risk Level</span>
        <div className="bap-metric-row">
          <span className="bap-old" style={{ color: RISK_COLOR[before.academic_risk] }}>
            {before.academic_risk}
          </span>
          <span className="bap-arrow">→</span>
          <span className="bap-new" style={{ color: RISK_COLOR[after.academic_risk] }}>
            {after.academic_risk}
          </span>
          <span
            className="bap-delta"
            style={{
              color: !riskChanged
                ? 'var(--cpe-text-faint)'
                : riskImproved
                  ? 'var(--cpe-green)'
                  : 'var(--cpe-red)',
            }}
          >
            {!riskChanged ? 'no change' : riskImproved ? 'improved' : 'worsened'}
          </span>
        </div>
      </div>
    </section>
  );
}
