import Topbar from "../../Components/academic/Layout/Topbar";
import CalendarView from "../../Components/academic/Calendar/CalendarView";

export default function Calendar() {
  return (
    <div>
      <Topbar title="Calendar" subtitle="Assignments, exams, sessions, and deadlines in one place." />
      <div className="px-4 sm:px-6 pb-10">
        <CalendarView />
      </div>
    </div>
  );
}
