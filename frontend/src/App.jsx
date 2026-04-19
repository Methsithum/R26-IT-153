import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Navbar } from './components/layout/Navbar'
import { JournalProvider } from './context/JournalContext'
import DashboardPage from './pages/DashboardPage'
import HomePage from './pages/HomePage'
import JournalPage from './pages/JournalPage'
import ProfilePage from './pages/ProfilePage'
import ReflectionPage from './pages/ReflectionPage'

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/reflection" element={<ReflectionPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  return (
    <JournalProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#111827,#020617_58%)] text-slate-100">
          <Sidebar />
          <main className="px-4 pb-20 pt-4 lg:ml-72 lg:px-8 lg:pb-8 lg:pt-6">
            <Navbar />
            <AnimatedRoutes />
          </main>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#0f172a',
                color: '#f8fafc',
                border: '1px solid rgba(245, 158, 11, 0.35)',
              },
            }}
          />
        </div>
      </BrowserRouter>
    </JournalProvider>
  )
}

export default App