import { Route, Routes } from 'react-router-dom';

import Header from './components/Header';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import ProfileList from './pages/ProfileList';
import ModelMetrics from './pages/ModelMetrics';

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
          {/* Unknown sub-paths fall back to the dashboard. */}
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
