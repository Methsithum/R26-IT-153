import './styles.css';

/**
 * Top banner for the application.
 * Static presentational component - no props.
 */
export default function Header() {
  return (
    <header className="app-header">
      <div className="app-header-mark">◈</div>
      <div className="app-header-text">
        <span className="app-header-eyebrow">AI Student Intelligence</span>
        <h1 className="app-header-title">Future &amp; Career Prediction Engine</h1>
        <p className="app-header-sub">
          Holistic forecasting across academic, emotional, and behavioral domains
        </p>
      </div>
    </header>
  );
}
