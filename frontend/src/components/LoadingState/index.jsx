import './styles.css';

/**
 * Full-panel loading indicator.
 * @param {string} [message] - optional override for the default text
 */
export default function LoadingState({ message = 'Loading prediction...' }) {
  return (
    <div className="cp-loading">
      <span className="cp-spinner" />
      <p className="cp-loading-text">{message}</p>
    </div>
  );
}
