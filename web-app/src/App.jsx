import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const Landing        = lazy(() => import('./pages/Landing'));
const Login          = lazy(() => import('./pages/Login'));
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const SignUp         = lazy(() => import('./pages/SignUp'));
const Module         = lazy(() => import('./pages/Module'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ViewProgress   = lazy(() => import('./pages/ViewProgress'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword  = lazy(() => import('./pages/ResetPassword'));
const UserProfile    = lazy(() => import('./pages/UserProfile'));

const PageLoader = () => (
  <div className="h-screen bg-tello-dark flex items-center justify-center text-white text-sm tracking-widest opacity-60">
    LOADING...
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;