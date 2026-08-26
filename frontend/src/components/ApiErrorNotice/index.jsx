import './styles.css';

/**
 * Shown when the backend cannot be reached, with the command to start it.
 * @param {string}   [message] - the underlying error text from the failed call
 * @param {function} [onRetry] - callback to re-attempt the request
 */
export default function ApiErrorNotice({ message, onRetry }) {
  return (
    <div className="cp-error">
      <div className="cp-error-icon">⚠</div>
      <h2 className="cp-error-title">API not connected</h2>

      {message && <p className="cp-error-detail">{message}</p>}

      <p className="cp-error-hint">Start the backend, then retry:</p>
      <pre className="cp-error-cmd">
        cd backend\app\career-prediction-engine{'\n'}
        python -m uvicorn prediction_api:app --reload --port 8001
      </pre>

      {onRetry && (
        <button type="button" className="cp-error-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
