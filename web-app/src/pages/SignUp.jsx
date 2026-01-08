import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

// Reusing the same Layout for consistency
const AuthLayout = ({ title, children }) => (
  <div className="min-h-screen bg-tello-dark flex flex-col justify-center items-center">
    <div className="bg-white/10 backdrop-blur-md p-10 rounded-3xl w-full max-w-md text-center shadow-2xl border border-white/20">
      <h2 className="text-3xl font-bold text-white mb-8">{title}</h2>
      {children}
    </div>
    <p className="text-slate-400 mt-8 text-sm">Copyright © TelloLearn Inc.</p>
  </div>
);

export default function SignUp() {
  const navigate = useNavigate();
  
  // 1. State for the 3 fields
  const [formData, setFormData] = useState({ 
    username: '', 
    email: '', 
    password: '' 
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2. Update state on typing
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // 3. Handle Form Submission
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Connect to the Backend Signup Endpoint
      const response = await fetch('http://127.0.0.1:8000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // SUCCESS: Redirect to Login page so they can sign in
        alert("Account created successfully! Please Log In.");
        navigate('/login');
      } else {
        // FAIL: Show error (e.g., "Username already taken")
        setError(data.detail || 'Registration failed');
      }
    } catch (err) {
      setError('Cannot connect to Ground Station.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Join TelloLearn">
      <form onSubmit={handleSignUp} className="flex flex-col gap-4">
        
        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* 1. Username Field */}
        <input 
          name="username"
          type="text" 
          placeholder="Username" 
          value={formData.username}
          onChange={handleChange}
          className="bg-white px-4 py-3 rounded-lg outline-none focus:ring-2 ring-tello-accent text-slate-800"
          required
        />

        {/* 2. Email Field */}
        <input 
          name="email"
          type="email" 
          placeholder="Email Address" 
          value={formData.email}
          onChange={handleChange}
          className="bg-white px-4 py-3 rounded-lg outline-none focus:ring-2 ring-tello-accent text-slate-800"
          required
        />
        
        {/* 3. Password Field */}
        <input 
          name="password"
          type="password" 
          placeholder="Password" 
          value={formData.password}
          onChange={handleChange}
          className="bg-white px-4 py-3 rounded-lg outline-none focus:ring-2 ring-tello-accent text-slate-800"
          required
        />
        
        {/* Switch to Login Link */}
        <div className="text-right text-sm text-slate-300 px-1">
          <span>Already have an account? </span>
          <Link to="/login" className="hover:text-white font-bold underline">
            Log In here
          </Link>
        </div>

        {/* Submit Button */}
        <button 
          type="submit" 
          disabled={loading}
          className={`bg-tello-dark text-white py-3 rounded-full font-bold mt-4 transition border border-slate-600 
            ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black'}`}
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
        
      </form>
    </AuthLayout>
  );
}