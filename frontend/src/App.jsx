import { Route, Routes } from 'react-router-dom';

import CareerPredictionEngine from './career-prediction-engine/CareerPredictionEngine';
import './App.css';

/**
 * Application shell.
 *
 * Each teammate's component mounts under its own path prefix. The trailing
 * "/*" lets that component own all of its own sub-routes.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<CareerPredictionEngine />} />
    </Routes>
  );
}
