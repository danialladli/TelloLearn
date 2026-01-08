import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Import your pages (Make sure these files exist in src/pages!)
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SignUp from './pages/SignUp';
import Module from './pages/Module';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/module/:moduleId" element={<Module />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;