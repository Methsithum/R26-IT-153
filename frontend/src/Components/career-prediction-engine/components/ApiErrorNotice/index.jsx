import './styles.css';

/**
 * Shown when the backend cannot be reached, with the command to start it.
 * @param {string}   [message] - the underlying error text from the failed call
 * @param {function} [onRetry] - callback to re-attempt the request
 */
export default function ApiErrorNotice({ message, onRetry }) {
  return (
    <div className="cpe-error">
      <div className="cpe-error-icon">⚠</div>
      <h2 className="cpe-error-title">API not connected</h2>

      {message && <p className="cpe-error-detail">{message}</p>}

      <p className="cpe-error-hint">Start the backend, then retry:</p>
      <pre className="cpe-error-cmd">
        cd backend{'\n'}
        python -m uvicorn app.main:app --reload --port 8000
      </pre>

      {onRetry && (
        <button type="button" className="cpe-error-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
