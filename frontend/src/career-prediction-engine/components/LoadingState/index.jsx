import './styles.css';

/**
 * Full-panel loading indicator.
 * @param {string} [message] - optional override for the default text
 */
export default function LoadingState({ message = 'Loading prediction...' }) {
  return (
    <div className="cpe-loading">
      <span className="cpe-spinner" />
      <p className="cpe-loading-text">{message}</p>
    </div>
  );
}
