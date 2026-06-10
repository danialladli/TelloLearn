import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, PlayCircle, User, ArrowLeft } from 'lucide-react';
import { API_URL, apiFetch } from '../config';

export default function ViewProgress() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      const username = localStorage.getItem('username');
      if (!username) return navigate('/login');

      try {
        // 1. Get Token (Assuming you stored token in login, if not, we rely on username logic or re-login)
        // For this demo, let's assume we need to fetch the ID via the /me endpoint first OR use the stored token if you implemented it.
        // If you didn't store the token in localStorage during login, we might need to rely on the backend session or update login.
        // Let's assume you have a 'user_id' stored or fetch it.
        
        // Simpler approach for your current setup: Fetch /me to get ID, then fetch activity
        const userRes = await apiFetch(`${API_URL}/api/auth/me/${username}`);
        const userData = await userRes.json();
        
        // Use the token for the protected route (if you implemented tokens in headers)
        // Or pass User ID manually if your security is relaxed for the demo.
        // Let's assume we use the Token flow properly:
        const token = localStorage.getItem('user_token'); // Make sure Login.jsx saves this!

        const res = await apiFetch(`${API_URL}/api/activity`, {
             headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            setActivities(data);
        }
      } catch (err) {
        console.error("Failed to load timeline", err);
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, []);

  // Helper to format date
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    
    // 1. Format the Date (DD/MM/YYYY)
    const datePart = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Kuala_Lumpur'
    }).format(date);

    // 2. Format the Time (12-hour format with AM/PM)
    const timePart = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kuala_Lumpur'
    }).format(date);

    return `${datePart} - ${timePart}`;
  };

  // Helper for Icons
  const getIcon = (action) => {
    switch (action) {
        case 'ACCOUNT_CREATED': return <User className="text-white" size={20} />;
        case 'MODULE_STARTED': return <PlayCircle className="text-white" size={20} />;
        case 'MODULE_COMPLETED': return <CheckCircle className="text-white" size={20} />;
        default: return <Clock className="text-white" size={20} />;
    }
  };

  // Helper for Colors
  const getColor = (action) => {
    switch (action) {
        case 'ACCOUNT_CREATED': return 'bg-blue-500';
        case 'MODULE_STARTED': return 'bg-yellow-500';
        case 'MODULE_COMPLETED': return 'bg-green-500';
        default: return 'bg-slate-500';
    }
  };

  return (
    <div className="min-h-screen bg-tello-dark text-slate-100 p-8">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-8 flex items-center gap-4">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
            <ArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-bold">Flight Log & Timeline</h1>
      </div>

      {/* Timeline Container */}
      <div className="max-w-3xl mx-auto bg-slate-800/50 p-8 rounded-3xl border border-slate-700 relative">
        {loading ? (
            <div className="text-center p-10">Loading Flight Recorder...</div>
        ) : activities.length === 0 ? (
            <div className="text-center text-slate-400">No activity recorded yet. Go fly some drones!</div>
        ) : (
            <div className="relative border-l-2 border-slate-600 ml-4 space-y-8">
                {activities.map((log) => (
                    <div key={log.id} className="relative pl-8">
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[11px] top-1 w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-800 ${getColor(log.action)}`}>
                            {getIcon(log.action)}
                        </div>

                        {/* Card */}
                        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 hover:border-slate-500 transition shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="font-bold text-lg text-white">
                                    {log.action.replace(/_/g, ' ')}
                                </h3>
                                <span className="text-xs text-slate-400 font-mono">
                                    {formatDate(log.timestamp)}
                                </span>
                            </div>
                            <p className="text-slate-300">{log.details}</p>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}