import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Import your pages (Make sure these files exist in src/pages!)
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SignUp from './pages/SignUp';
import Module from './pages/Module';
import AdminDashboard from './pages/AdminDashboard';
import ViewProgress from './pages/ViewProgress';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import UserProfile from './pages/UserProfile';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/module/:moduleId" element={<Module />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/progress" element={<ViewProgress />} />
        <Route path="/profile" element={<UserProfile />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;