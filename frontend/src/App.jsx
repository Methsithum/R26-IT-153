import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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
