import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Save, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { API_URL } from '../config';

// Define your default avatars here
const AVATAR_OPTIONS = [
  "/assets/avatars/bike.png",
  "/assets/avatars/bow.png",
  "/assets/avatars/gun.png",
  "/assets/avatars/roses.png",
  "/assets/avatars/soccer-ball.png",
  "/assets/avatars/tank.png",
  "/assets/avatars/travel.png"
];

export default function Profile() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '', // Kept blank by default, only sent if user types a new one
    avatar: ''
  });

  const [status, setStatus] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      const storedUsername = localStorage.getItem('username');
      if (!storedUsername) {
        navigate('/login');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/me/${storedUsername}`);
        if (response.ok) {
          const data = await response.json();
          setUserId(data.id);
          setFormData({
            username: data.username || '',
            email: data.email || '',
            password: '', 
            avatar: data.avatar || AVATAR_OPTIONS[0] // Fallback to first avatar if none
          });
        }
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAvatarSelect = (avatarUrl) => {
    setFormData({ ...formData, avatar: avatarUrl });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setStatus({ type: '', message: '' });

    // Only send the password if they actually typed a new one
    const payload = { ...formData };
    if (!payload.password) {
      delete payload.password;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', message: 'Profile updated successfully!' });
        
        // CRITICAL: If they changed their username, update localStorage so the app doesn't break
        if (result.username) {
          localStorage.setItem('username', result.username);
        }
        
        // Clear password field after successful save
        setFormData(prev => ({ ...prev, password: '' }));
      } else {
        setStatus({ type: 'error', message: result.detail || 'Failed to update profile.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-900 flex justify-center items-center text-white">Loading Flight Profile...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/dashboard" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition">
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </Link>
          <h1 className="text-3xl font-bold text-white">Pilot Profile</h1>
        </div>

        <div className="bg-slate-800 rounded-3xl p-8 shadow-2xl border border-slate-700">
          
          {status.message && (
            <div className={`p-4 rounded-xl mb-6 text-sm font-medium border ${status.type === 'success' ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-red-900/30 text-red-400 border-red-800'}`}>
              {status.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-10">
            
            {/* Left Column: Avatar Selection */}
            <div className="w-full md:w-1/3 flex flex-col items-center">
              <div className="w-32 h-32 rounded-full border-4 border-blue-500 overflow-hidden bg-slate-900 mb-6 shadow-lg">
                <img 
                  src={formData.avatar || `https://ui-avatars.com/api/?name=${formData.username}&background=random`} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              </div>
              
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ImageIcon size={16} /> Choose Avatar
              </h3>
              
              <div className="grid grid-cols-3 gap-3 w-full">
                {AVATAR_OPTIONS.map((avatar, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAvatarSelect(avatar)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 ${formData.avatar === avatar ? 'border-blue-500 scale-105 shadow-lg shadow-blue-500/20' : 'border-transparent hover:border-slate-500 opacity-70 hover:opacity-100'}`}
                  >
                    <img src={avatar} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover bg-slate-700" />
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: Credentials Form */}
            <div className="flex-1 flex flex-col gap-6">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <User size={14} /> Callsign (Username)
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Mail size={14} /> Comm Link (Email)
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Lock size={14} /> Update Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Leave blank to keep current password"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition placeholder:text-slate-600"
                />
              </div>

              <div className="mt-4 pt-6 border-t border-slate-700 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-8 py-3 rounded-xl font-bold text-white flex items-center gap-2 transition ${isSaving ? 'bg-blue-600/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 shadow-lg active:scale-95'}`}
                >
                  <Save size={18} />
                  {isSaving ? 'Updating...' : 'Save Profile'}
                </button>
              </div>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}