import { useEffect } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

// Focus component
import FocusApp from "./components/focus/FocusApp";

// Career Prediction Engine component
import CareerPredictionEngine from "./Components/career-prediction-engine/CareerPredictionEngine";

// Journal components
import JournalHome from "./Pages/Journal/JournalHome";
import DailyActivitySelection from "./Pages/Journal/DailyActivitySelection";
import GamePage from "./Pages/Journal/GamePage";

// Authentication
import Register from "./Pages/Auth/Register";
import Login from "./Pages/Auth/Login";

// User / Game / Journal services
import {
  loadUserWorld,
  readStoredUser,
  refreshStoredUser,
} from "./services/userApi";

import {
  isActiveCampusRun,
  useGameStore,
} from "./Game/state/GameStateManager";

import { useJournalHistoryStore } from "./Game/state/journalHistoryStore";
import { useAcademicStore } from "./store/useAcademicStore";

// Study Planner
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


/* =========================================================
   AUTH GUARDS
========================================================= */

function RequireAuth({ children }) {
  const user = readStoredUser();

  if (!user?.id) {
    return <Navigate to="/login" replace />;
  }

  return children;
}


function RedirectIfAuthed({ children }) {
  const user = readStoredUser();

  if (user?.id) {
    return <Navigate to="/" replace />;
  }

  return children;
}


/* =========================================================
   USER DATA HYDRATION
========================================================= */

function HydrateUser({ children }) {
  useEffect(() => {
    const local = readStoredUser();

    // Preserve an active campus run when refreshing/loading data.
    const preserveRun = isActiveCampusRun(useGameStore.getState());

    if (local) {
      useGameStore
        .getState()
        .applyUserProgress(local, { preserveRun });

      useAcademicStore
        .getState()
        .syncProfileFromUser(useGameStore.getState());
    }

    let cancelled = false;

    (async () => {
      try {
        const user = await refreshStoredUser();

        if (cancelled) return;

        if (!user) {
          window.location.assign("/login");
          return;
        }

        // Preserve currently running campus game.
        const stillRunning = isActiveCampusRun(
          useGameStore.getState()
        );

        useGameStore
          .getState()
          .applyUserProgress(user, {
            preserveRun: stillRunning,
          });

        useAcademicStore
          .getState()
          .syncProfileFromUser(useGameStore.getState());

        // Load user's complete world data.
        const world = await loadUserWorld(user.id);

        if (cancelled) return;

        useGameStore
          .getState()
          .applyWorldRecords(world);

        // Hydrate journal history.
        useJournalHistoryStore
          .getState()
          .hydrateFromSessions(
            world.sessions,
            user.id
          );

        // Sync study planner data.
        useAcademicStore
          .getState()
          .syncFromJournal({
            tasks: world.tasks,
            exams: world.exams,
            subjects: user.subjects,
          });

      } catch (error) {
        // Offline mode:
        // Local stored progress is still available.
        console.warn(
          "Failed to refresh user data. Using local data.",
          error
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return children;
}


/* =========================================================
   APP
========================================================= */

function App() {
  return (
    <Router>
      <Routes>

        {/* =================================================
            PUBLIC / AUTH ROUTES
        ================================================= */}

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


        {/* =================================================
            FOCUS MODULE
            From Student_Focus_Train_ML_3
        ================================================= */}

        <Route
          path="/focus"
          element={
            <RequireAuth>
              <HydrateUser>
                <FocusApp />
              </HydrateUser>
            </RequireAuth>
          }
        />


        {/* =================================================
            CAREER PREDICTION ENGINE MODULE
            Owns its own sub-routes (dashboard / profiles / metrics),
            hence the trailing "/*".
        ================================================= */}

        <Route
          path="/career/*"
          element={
            <RequireAuth>
              <HydrateUser>
                <CareerPredictionEngine />
              </HydrateUser>
            </RequireAuth>
          }
        />


        {/* =================================================
            JOURNAL MODULE
        ================================================= */}

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


        {/* =================================================
            STUDY PLANNER MODULE
        ================================================= */}

        <Route
          element={
            <RequireAuth>
              <HydrateUser>
                <AppLayout />
              </HydrateUser>
            </RequireAuth>
          }
        >

          {/* Dashboard */}
          <Route
            path="/"
            element={<Dashboard />}
          />

          {/* Study Planner */}
          <Route
            path="/study-planner"
            element={<StudyPlanner />}
          />

          {/* Tasks */}
          <Route
            path="/tasks"
            element={<Tasks />}
          />

          <Route
            path="/tasks/:taskId"
            element={<TaskDetails />}
          />

          {/* Modules */}
          <Route
            path="/modules"
            element={<Modules />}
          />

          <Route
            path="/modules/:code"
            element={<ModuleDetail />}
          />

          {/* Exams */}
          <Route
            path="/exams"
            element={<Exams />}
          />

          {/* Analytics */}
          <Route
            path="/analytics"
            element={<Analytics />}
          />

          {/* Academic Data */}
          <Route
            path="/add-academic-data"
            element={<AddAcademicData />}
          />

          {/* Notifications */}
          <Route
            path="/notifications"
            element={<Notifications />}
          />

          {/* Calendar */}
          <Route
            path="/calendar"
            element={<CalendarPage />}
          />

          {/* Settings */}
          <Route
            path="/settings"
            element={<Settings />}
          />

          {/* Profile */}
          <Route
            path="/profile"
            element={<Profile />}
          />

        </Route>


        {/* =================================================
            FALLBACK
        ================================================= */}

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
    </Router>
  );
}

export default App;