import { NavLink, useLocation } from 'react-router-dom';
import './styles.css';

/**
 * Route targets rendered as tabs, relative to the feature root.
 *
 * The path is stored without a leading slash and resolved against the mount
 * point below, so the feature keeps working wherever the host app mounts it.
 */
const TABS = [
  { to: '', label: 'Dashboard', end: true },
  // TEMPORARY - remove with pages/DataCheck.jsx
  { to: 'data-check', label: 'Data Check', end: false },
];

/**
 * Every page segment the feature routes - including "profiles" and "metrics",
 * which are reachable by URL but have no tab. Used to strip the page off the
 * current path to find the feature root.
 *
 * Keep entries here even when the tab is removed: if "/career/metrics" is open
 * and "metrics" is missing from this list, the remaining tabs resolve against
 * the full path and build "/career/metrics/data-check".
 */
const PAGE_SEGMENTS = ['profiles', 'metrics', 'data-check'];

/**
 * Tab navigation across the feature's pages.
 *
 * This nav sits outside the <Routes> block, so a relative `to` resolves
 * against the URL currently showing rather than the feature root: from
 * "/career/metrics" a link to "profiles" becomes
 * "/career/metrics/profiles", and every further click appends again.
 *
 * The fix is to build absolute hrefs from the feature root, found by removing
 * a known page segment from the end of the current path.
 */
export default function Navbar() {
  const { pathname } = useLocation();

  // "/career/metrics" -> "/career";  "/career" -> "/career"
  const trimmed = pathname.replace(/\/+$/, '');
  const lastSlash = trimmed.lastIndexOf('/');
  const lastSegment = trimmed.slice(lastSlash + 1);
  const base = PAGE_SEGMENTS.includes(lastSegment)
    ? trimmed.slice(0, lastSlash) || '/'
    : trimmed || '/';

  return (
    <nav className="cpe-navbar">
      {TABS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to ? `${base === '/' ? '' : base}/${to}` : base}
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
