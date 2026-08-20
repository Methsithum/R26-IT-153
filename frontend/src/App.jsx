import { useEffect } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import JournalHome from "./Pages/Journal/JournalHome";
import DailyActivitySelection from "./Pages/Journal/DailyActivitySelection";
import GamePage from "./Pages/Journal/GamePage";
import Register from "./Pages/Auth/Register";
import Login from "./Pages/Auth/Login";
import { loadUserWorld, readStoredUser, refreshStoredUser } from "./services/userApi";
import { isActiveCampusRun, useGameStore } from "./Game/state/GameStateManager";
import { useJournalHistoryStore } from "./Game/state/journalHistoryStore";

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
      <div className="h-full">
        <Routes>
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
          <Route
            path="/"
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
        </Routes>
      </div>
    </Router>
  );
}

export default App;
