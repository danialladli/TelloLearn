import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Shield } from 'lucide-react'; // Icons
import { API_URL, apiFetch } from '../config';

const AuthLayout = ({ title, children }) => (
  <div className="min-h-screen bg-tello-dark flex flex-col justify-center items-center">
    <div className="bg-white/10 backdrop-blur-md p-10 rounded-3xl w-full max-w-md text-center shadow-2xl border border-white/20">
      <h2 className="text-3xl font-bold text-white mb-8">{title}</h2>
      {children}
    </div>
    <p className="text-slate-400 mt-8 text-sm">Copyright © TelloLearn Inc.</p>
  </div>
);

export default function Login() {
  const navigate = useNavigate(); // <--- Initialize hook

  // 1. State to store input values
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('learner');


  // 2. Handle typing in inputs
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // 3. The Real Login Logic
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiFetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // --- 1. VALIDATION CHECKS ---
        
        // Scenario A: User selected "Admin" but is actually a "Learner"
        if (selectedRole === 'admin' && data.role !== 'admin') {
          setError("Access Denied: You are not an Admin.");
          setLoading(false);
          return;
        }

        // Scenario B: User selected "Learner" but is actually an "Admin"
        // [NEW CHECK] This fixes your issue
        if (selectedRole === 'learner' && data.role === 'admin') {
          setError("Access Denied: Account registered as Admin. Please toggle to Admin to login.");
          setLoading(false);
          return;
        }

        // --- 2. SUCCESS ---
        // Clear previous user's cache before storing new session
        localStorage.removeItem('cached_modules');
        localStorage.removeItem('cached_avatar');
        localStorage.setItem('username', data.username);
        localStorage.setItem('role', data.role);
        localStorage.setItem('user_token', data.token);

        // Route based on Role
        if (data.role === 'admin') {
          navigate('/admin-dashboard');
        } else {
          navigate('/dashboard');
        }
      } else {
        setError(data.detail || 'Login failed');
      }
    } catch (err) {
      console.error(err);
      setError('Cannot connect to Ground Station');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="TelloLearn">
      {/* ROLE TOGGLE */}
      <div className="flex bg-slate-700/50 p-1 rounded-full mb-6">
        <button 
          type="button"
          onClick={() => setSelectedRole('learner')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full transition ${selectedRole === 'learner' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-300 hover:text-white'}`}
        >
          <User size={16} /> Learner
        </button>
        <button 
          type="button"
          onClick={() => setSelectedRole('admin')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full transition ${selectedRole === 'admin' ? 'bg-red-500 text-white shadow-lg' : 'text-slate-300 hover:text-white'}`}
        >
          <Shield size={16} /> Admin
        </button>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        
        {/* Error Message Banner */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <input 
          name="username"
          type="text" 
          placeholder="Username" 
          value={formData.username}
          onChange={handleChange}
          className="bg-white px-4 py-3 rounded-lg outline-none focus:ring-2 ring-tello-accent text-slate-800"
          required
        />
        
        <input 
          name="password"
          type="password" 
          placeholder="Password" 
          value={formData.password}
          onChange={handleChange}
          className="bg-white px-4 py-3 rounded-lg outline-none focus:ring-2 ring-tello-accent text-slate-800"
          required
        />
        
        <div className="flex justify-between text-sm text-slate-300 px-1">
          <Link to="/forgot-password" className="hover:text-white text-sm transition">
            Forgot Password?
          </Link>
          <Link to="/signup" className="hover:text-white font-bold transition">
            Sign Up
          </Link>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className={`bg-tello-dark text-white py-3 rounded-full font-bold mt-4 transition border border-slate-600 
            ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black'}`}
        >
          {loading ? 'Connecting...' : 'Log In'}
        </button>
        
      </form>
    </AuthLayout>
  );
}