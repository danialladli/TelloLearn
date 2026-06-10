import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token'); // Grabs the token from the URL

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If someone navigates here without a token, warn them
  useEffect(() => {
    if (!token) {
      setError('Invalid link. No reset token provided.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }), // Must match backend model
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Password reset successfully! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(data.detail || 'Failed to reset password. The link may have expired.');
      }
    } catch (err) {
      setError('Network error. Please make sure the server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 max-w-md w-full p-8 rounded-2xl text-center shadow-xl border border-red-900/50">
          <h2 className="text-xl font-bold text-red-400 mb-4">Invalid Link</h2>
          <p className="text-slate-400 mb-6">No reset token was found in the URL.</p>
          <Link to="/forgot-password" className="text-blue-400 hover:text-blue-300">Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 max-w-md w-full p-8 rounded-2xl shadow-xl border border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Set New Password</h2>
        <p className="text-slate-400 text-sm mb-6 text-center">Enter your new secure password below.</p>

        {message && <div className="bg-green-900/50 text-green-400 p-3 rounded-lg mb-4 text-sm border border-green-800">{message}</div>}
        {error && <div className="bg-red-900/50 text-red-400 p-3 rounded-lg mb-4 text-sm border border-red-800">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-slate-300 block mb-1">New Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300 block mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !password || !confirmPassword}
            className={`w-full py-2.5 rounded-lg font-bold text-white transition mt-2 ${
              isLoading || !password || !confirmPassword ? 'bg-blue-600/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 shadow-lg'
            }`}
          >
            {isLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}