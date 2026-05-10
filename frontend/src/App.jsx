import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FocusApp from "./components/focus/FocusApp";


function App() {
  return (
    <Router>
      
      <div>
        
        <Routes>
          <Route path="/" element={<FocusApp/>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;