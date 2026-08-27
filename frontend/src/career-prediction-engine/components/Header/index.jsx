import './styles.css';

/**
 * Top banner for the Career Prediction Engine.
 * Static presentational component - no props.
 */
export default function Header() {
  return (
    <header className="cpe-header">
      <div className="cpe-header-mark">◈</div>
      <div className="cpe-header-text">
        <span className="cpe-header-eyebrow">AI Student Intelligence</span>
        <h1 className="cpe-header-title">Future &amp; Career Prediction Engine</h1>
        <p className="cpe-header-sub">
          Holistic forecasting across academic, emotional, and behavioral domains
        </p>
      </div>
    </header>
  );
}
