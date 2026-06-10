import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setEmail(''); // Clear the input
      } else {
        setError(data.detail || 'Failed to request password reset.');
      }
    } catch (err) {
      setError('Network error. Please make sure the server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 max-w-md w-full p-8 rounded-2xl shadow-xl border border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Reset Password</h2>
        <p className="text-slate-400 text-sm mb-6 text-center">
          Enter your email and we'll send you instructions to reset your password.
        </p>

        {message && <div className="bg-green-900/50 text-green-400 p-3 rounded-lg mb-4 text-sm border border-green-800">{message}</div>}
        {error && <div className="bg-red-900/50 text-red-400 p-3 rounded-lg mb-4 text-sm border border-red-800">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-slate-300 block mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition"
              placeholder="pilot@tellolearn.com"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email}
            className={`w-full py-2.5 rounded-lg font-bold text-white transition mt-2 ${
              isLoading || !email ? 'bg-blue-600/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 shadow-lg'
            }`}
          >
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-blue-400 hover:text-blue-300 text-sm transition">
            &larr; Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}