import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppLayout from "./Components/academic/Layout/AppLayout";
import Dashboard from "./Pages/academic/Dashboard";
import StudyPlanner from "./Pages/academic/StudyPlanner";
import Tasks from "./Pages/academic/Tasks";
import TaskDetails from "./Pages/academic/TaskDetails";
import Modules from "./Pages/academic/Modules";
import ModuleDetail from "./Pages/academic/ModuleDetail";
import Exams from "./Pages/academic/Exams";
import Analytics from "./Pages/academic/Analytics";
import AddAcademicData from "./Pages/academic/AddAcademicData";
import Notifications from "./Pages/academic/Notifications";
import Settings from "./Pages/academic/Settings";
import Profile from "./Pages/academic/Profile";
import CalendarPage from "./Pages/academic/Calendar";

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
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
