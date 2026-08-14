import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import JournalHome from './Pages/Journal/JournalHome';
import DailyActivitySelection from './Pages/Journal/DailyActivitySelection';
import GamePage from './Pages/Journal/GamePage';


function App() {
  return (
    <Router>

      <div>

        <Routes>
          <Route path="/" element={<JournalHome/>} />
          <Route path="/journal/activities" element={<DailyActivitySelection/>} />
          <Route path="/journal/game" element={<GamePage/>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;