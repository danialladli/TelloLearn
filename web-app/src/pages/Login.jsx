import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

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
    setError(''); // Clear previous errors
    setLoading(true);

    try {
      // Send data to Python Backend
      const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // SUCCESS: Save user to browser storage
        localStorage.setItem('user', JSON.stringify(data));
        
        // Go to Dashboard
        navigate('/dashboard');
      } else {
        // FAIL: Show error message from backend
        setError(data.detail || 'Login failed');
      }
    } catch (err) {
      setError('Cannot connect to Ground Station (Backend offline?)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="TelloLearn">
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
          <button type="button" className="hover:text-white">Forgot Password?</button>
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