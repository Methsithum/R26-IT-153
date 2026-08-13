import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GamePage from './Pages/Journal/GamePage';


function App() {
  return (
    <Router>

      <div>

        <Routes>
          <Route path="/" element={<GamePage/>} />
          <Route path="/journal/game" element={<GamePage/>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;