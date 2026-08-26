import { NavLink } from 'react-router-dom';
import './styles.css';

/** Route targets rendered as tabs. */
const TABS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/profiles', label: 'Student Profiles', end: false },
  { to: '/metrics', label: 'Model Metrics', end: false },
];

/**
 * Tab navigation across the three pages.
 * Uses NavLink so the active tab is styled automatically by the router.
 */
export default function Navbar() {
  return (
    <nav className="cp-navbar">
      {TABS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            isActive ? 'cp-tab cp-tab-active' : 'cp-tab'
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
