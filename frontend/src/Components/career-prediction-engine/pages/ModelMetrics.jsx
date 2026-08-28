import { useCallback, useEffect, useState } from 'react';

import { getModelMetrics } from '../api/predictionApi';
import LoadingState from '../components/LoadingState';
import ApiErrorNotice from '../components/ApiErrorNotice';
import './ModelMetrics.css';

/** Format a 0-1 ratio as a percentage string. */
const pct = (v) => `${(v * 100).toFixed(2)}%`;

/** Format a raw score to 4 decimal places. */
const dec = (v) => v.toFixed(4);

/**
 * Model evaluation results for both tasks, rendered as two comparison tables.
 * Every number comes from the /model-metrics endpoint.
 */
export default function ModelMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /**
   * Fetch metrics from the API.
   * `showSpinner` is false on the initial mount because `loading` already
   * starts true - this keeps the effect from setting state synchronously.
   */
  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
      setError('');
    }
    try {
      setMetrics(await getModelMetrics());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount.
  useEffect(() => {
    load(false);
  }, [load]);

  if (loading) return <LoadingState message="Loading model metrics..." />;
  if (error) return <ApiErrorNotice message={error} onRetry={load} />;

  const rowsA = metrics.model_A_rows ?? [];
  const rowsB = metrics.model_B_rows ?? [];

  return (
    <div className="mm">
      {/* Model A - classification */}
      <section className="cpe-panel">
        <h2 className="cpe-panel-title">Model A — Academic Risk Classification</h2>
        <div className="mm-scroll">
          <table className="mm-table">
            <thead>
              <tr>
                <th>Algorithm</th>
                <th>Accuracy</th>
                <th>F1</th>
                <th>CV Score</th>
              </tr>
            </thead>
            <tbody>
              {rowsA.map((r) => (
                <tr key={r.algorithm} className={r.winner ? 'mm-winner' : ''}>
                  <td>
                    {r.algorithm}
                    {r.winner && <span className="mm-tag">WINNER ✅</span>}
                  </td>
                  <td>{pct(r.accuracy)}</td>
                  <td>{dec(r.f1)}</td>
                  <td>{pct(r.cv_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Model B - regression */}
      <section className="cpe-panel">
        <h2 className="cpe-panel-title">Model B — Career Readiness Regression</h2>
        <div className="mm-scroll">
          <table className="mm-table">
            <thead>
              <tr>
                <th>Algorithm</th>
                <th>MAE</th>
                <th>RMSE</th>
                <th>R²</th>
              </tr>
            </thead>
            <tbody>
              {rowsB.map((r) => (
                <tr key={r.algorithm} className={r.winner ? 'mm-winner' : ''}>
                  <td>
                    {r.algorithm}
                    {r.winner && <span className="mm-tag">WINNER ✅</span>}
                  </td>
                  <td>{dec(r.mae)}</td>
                  <td>{dec(r.rmse)}</td>
                  <td>{dec(r.r2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Headline summary, driven by the winner values from the API. */}
      <section className="cpe-panel mm-summary">
        <h2 className="cpe-panel-title">Profile Validation Summary</h2>
        <div className="mm-summary-grid">
          <div className="mm-stat">
            <span className="mm-stat-val">{pct(metrics.model_A_accuracy)}</span>
            <span className="mm-stat-label">
              {metrics.model_A_winner} risk accuracy on held-out test data
            </span>
          </div>
          <div className="mm-stat">
            <span className="mm-stat-val">{dec(metrics.model_B_r2)}</span>
            <span className="mm-stat-label">
              {metrics.model_B_winner} R² for career readiness
            </span>
          </div>
          <div className="mm-stat">
            <span className="mm-stat-val">±{dec(metrics.model_B_mae)}</span>
            <span className="mm-stat-label">
              Mean absolute error on predicted career score
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
