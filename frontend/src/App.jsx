import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App