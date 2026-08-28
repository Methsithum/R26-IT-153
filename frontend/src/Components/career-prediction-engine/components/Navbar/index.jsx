import { NavLink } from 'react-router-dom';
import './styles.css';

/**
 * Route targets rendered as tabs.
 *
 * Paths are RELATIVE (no leading slash) so this feature keeps working
 * wherever the host app mounts it - at "/" today, at "/career" later.
 */
const TABS = [
  { to: '.', label: 'Dashboard', end: true },
  { to: 'profiles', label: 'Student Profiles', end: false },
  { to: 'metrics', label: 'Model Metrics', end: false },
];

/**
 * Tab navigation across the three pages.
 * Uses NavLink so the active tab is styled automatically by the router.
 */
export default function Navbar() {
  return (
    <nav className="cpe-navbar">
      {TABS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            isActive ? 'cpe-tab cpe-tab-active' : 'cpe-tab'
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
