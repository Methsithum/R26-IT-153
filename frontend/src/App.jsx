import { Route, Routes } from 'react-router-dom';

import Header from './components/Header';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import ProfileList from './pages/ProfileList';
import ModelMetrics from './pages/ModelMetrics';
import './App.css';

/**
 * Application shell: persistent header and tab bar above the routed page.
 */
export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <Navbar />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profiles" element={<ProfileList />} />
          <Route path="/metrics" element={<ModelMetrics />} />
          {/* Unknown paths fall back to the dashboard. */}
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
