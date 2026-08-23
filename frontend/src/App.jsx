import { useEffect } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";

// Journal component (teammate's)
import JournalHome from "./Pages/Journal/JournalHome";
import DailyActivitySelection from "./Pages/Journal/DailyActivitySelection";
import GamePage from "./Pages/Journal/GamePage";
import Register from "./Pages/Auth/Register";
import Login from "./Pages/Auth/Login";
import { loadUserWorld, readStoredUser, refreshStoredUser } from "./services/userApi";
import { isActiveCampusRun, useGameStore } from "./Game/state/GameStateManager";
import { useJournalHistoryStore } from "./Game/state/journalHistoryStore";

// Study Planner component (yours)
import AppLayout from "./Components/academic/Layout/AppLayout";
import Dashboard from "./Pages/studyplanner/Dashboard";
import StudyPlanner from "./Pages/studyplanner/StudyPlanner";
import Tasks from "./Pages/studyplanner/Tasks";
import TaskDetails from "./Pages/studyplanner/TaskDetails";
import Modules from "./Pages/studyplanner/Modules";
import ModuleDetail from "./Pages/studyplanner/ModuleDetail";
import Exams from "./Pages/studyplanner/Exams";
import Analytics from "./Pages/studyplanner/Analytics";
import AddAcademicData from "./Pages/studyplanner/AddAcademicData";
import Notifications from "./Pages/studyplanner/Notifications";
import Settings from "./Pages/studyplanner/Settings";
import Profile from "./Pages/studyplanner/Profile";
import CalendarPage from "./Pages/studyplanner/Calendar";

function RequireAuth({ children }) {
  const user = readStoredUser();
  if (!user?.id) return <Navigate to="/register" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const user = readStoredUser();
  if (user?.id) return <Navigate to="/" replace />;
  return children;
}

function HydrateUser({ children }) {
  useEffect(() => {
    const local = readStoredUser();
    const preserveRun = isActiveCampusRun(useGameStore.getState());
    if (local) useGameStore.getState().applyUserProgress(local, { preserveRun });
    let cancelled = false;
    (async () => {
      try {
        const user = await refreshStoredUser();
        if (cancelled) return;
        if (!user) {
          window.location.assign("/register");
          return;
        }
        const stillRunning = isActiveCampusRun(useGameStore.getState());
        useGameStore.getState().applyUserProgress(user, { preserveRun: stillRunning });
        const world = await loadUserWorld(user.id);
        if (cancelled) return;
        useGameStore.getState().applyWorldRecords(world);
        useJournalHistoryStore.getState().hydrateFromSessions(world.sessions, user.id);
      } catch {
        // Offline — local stored progress still applies.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* --- Public / auth routes --- */}
        <Route
          path="/register"
          element={
            <RedirectIfAuthed>
              <Register />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />

        {/* --- Journal component (teammate's) --- */}
        <Route
          path="/journal"
          element={
            <RequireAuth>
              <HydrateUser>
                <JournalHome />
              </HydrateUser>
            </RequireAuth>
          }
        />
        <Route
          path="/journal/activities"
          element={
            <RequireAuth>
              <HydrateUser>
                <DailyActivitySelection />
              </HydrateUser>
            </RequireAuth>
          }
        />
        <Route
          path="/journal/game"
          element={
            <RequireAuth>
              <HydrateUser>
                <GamePage />
              </HydrateUser>
            </RequireAuth>
          }
        />

        {/* --- Study Planner component (yours) — now auth-protected and sharing the same route tree --- */}
        <Route
          element={
            <RequireAuth>
              <HydrateUser>
                <AppLayout />
              </HydrateUser>
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/study-planner" element={<StudyPlanner />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/tasks/:taskId" element={<TaskDetails />} />
          <Route path="/modules" element={<Modules />} />
          <Route path="/modules/:code" element={<ModuleDetail />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/add-academic-data" element={<AddAcademicData />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;