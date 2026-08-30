import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';

import Header from './components/Header';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import ProfileList from './pages/ProfileList';
import ModelMetrics from './pages/ModelMetrics';
// TEMPORARY: diagnostic page for verifying the MongoDB data pipeline.
// Delete this import, its route below, and the Navbar tab when done.
import DataCheck from './pages/DataCheck';

import './theme.css';
import './CareerPredictionEngine.css';

/**
 * Self-contained entry point for the Career Prediction Engine component.
 *
 * Everything this feature needs lives under src/career-prediction-engine/,
 * so the rest of the app only has to mount this one element:
 *
 *   <Route path="/career/*" element={<CareerPredictionEngine />} />
 *
 * All styles are scoped under .cpe-root so they cannot leak into other
 * teammates' components.
 */
/**
 * Sends an unrecognised sub-path back to the feature root.
 *
 * `<Navigate to="">` would resolve against the current URL and land back on
 * itself, so the root is rebuilt from the splat: everything the "*" route
 * matched is stripped off the end of the current path.
 */
function RedirectToRoot() {
  const { pathname } = useLocation();
  const { '*': splat } = useParams();

  let root = pathname;
  if (splat && pathname.endsWith(splat)) {
    root = pathname.slice(0, -splat.length);
  }
  root = root.replace(/\/+$/, '') || '/';

  return <Navigate to={root} replace />;
}

export default function CareerPredictionEngine() {
  return (
    <div className="cpe-root">
      <Header />
      <Navbar />

      <main className="cpe-main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="profiles" element={<ProfileList />} />
          <Route path="metrics" element={<ModelMetrics />} />
          {/* TEMPORARY - remove with DataCheck.jsx */}
          <Route path="data-check" element={<DataCheck />} />
          {/* Unknown sub-paths redirect rather than render, so a stale or
              malformed URL cannot keep accumulating segments. */}
          <Route path="*" element={<RedirectToRoot />} />
        </Routes>
      </main>
    </div>
  );
}
