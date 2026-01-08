import React, { useState, useEffect } from 'react';
import { Lock, Play, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MODULE_IMAGES = {
  "1": "./assets/basic_flight_control.png",
  "2": "./assets/landing_pad.png",
  "3": "./assets/alphabet_recognition.png",
  "4": "./assets/shortest_path.png",
  "5": "./assets/swarm.png"
};

// Reusable Module Card Component
const ModuleCard = ({ module, onStart }) => {
  // Determine style based on status
  // Status comes from DB: 'locked', 'active', or 'completed'
  const isLocked = module.is_locked;
  const isCompleted = module.status === 'completed';

  return (
    <div className={`group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 ${isLocked ? 'opacity-70' : ''}`}>
      
      {/* Image Section */}
      <div className="h-40 bg-slate-200 relative overflow-hidden">
        {/* Get image from our map, or use a default if missing */}
        <img 
          src={MODULE_IMAGES[module.id] || "/img-module-1.jpg"} 
          alt={module.title} 
          className="w-full h-full object-cover transition group-hover:scale-105" 
        />
        
        {/* Overlay for Locked Modules */}
        {isLocked && (
          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
            <Lock className="text-white w-10 h-10 opacity-80" />
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-5 flex flex-col h-[200px]">
        <div className="flex justify-between items-center mb-2">
          <span className={`text-xs font-bold uppercase tracking-wider ${isLocked ? 'text-slate-400' : 'text-blue-600'}`}>
            Module {module.id}
          </span>
          {isCompleted && <CheckCircle className="text-green-500 w-5 h-5" />}
        </div>

        <h3 className="text-lg font-bold text-tello-dark leading-tight mb-2">
          {module.title}
        </h3>
        
        <p className="text-sm text-slate-500 mb-4 flex-1">
          {module.description}
        </p>

        {/* Dynamic Button */}
        <button 
          onClick={() => onStart(module.id)}
          disabled={isLocked}
          className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition
            ${isLocked 
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
              : isCompleted
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-tello-dark text-white hover:bg-black'
            }
          `}
        >
          {isLocked ? 'Locked' : isCompleted ? 'Review Mission' : 'Start Mission'}
        </button>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [username, setUsername] = useState('Pilot');
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch user data and modules when component loads
  useEffect(() => {
    // 1. Get user from local storage
    const storedUser = localStorage.getItem('user');
    
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUsername(userData.username);

      // Use the username to fetch their specific progress
    fetch(`http://127.0.0.1:8000/api/modules/${userData.username}`)
      .then(res => res.json())
      .then(data => {
        setModules(data);
        setLoading(false);
      });
    } else {
      // If no user is logged in, kick them back to login page
      window.location.href = '/login';
    }
  }, []);

  // This function runs automatically when the page loads
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/modules') // <--- Talk to Python
      .then(res => res.json())
      .then(data => {
        setModules(data); // Save the Python data to React
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch modules:", err);
        setLoading(false);
      });
  }, []);

  // Handler for starting a mission
  const handleStartMission = (moduleId) => {
    navigate(`/module/${moduleId}`);
  };

  if (loading) return <div className="text-white text-center mt-20">Connecting to Ground Station...</div>;

  const completedCount = modules.filter(m => m.status === 'completed').length;
  const totalCount = modules.length || 1; // Avoid divide by zero
  const progressPercentage = (completedCount / totalCount) * 100;

  return (
    <div className="min-h-screen bg-tello-dark pb-20">
      {/* Header */}
      <nav className="bg-white/10 backdrop-blur-sm px-8 py-4 flex justify-between items-center border-b border-white/10">
        <h1 className="text-2xl font-bold text-white">TelloLearn</h1>
        <div className="flex items-center gap-4">
          <span className="text-white font-medium">Pilot {username}</span>
          <div className="w-10 h-10 bg-slate-200 rounded-full border-2 border-white overflow-hidden">
            <img src={`https://ui-avatars.com/api/?name=${username}&background=random`} alt="Profile" />
          </div>
        </div>
      </nav>

      {/* Progress Section */}
      <div className="max-w-6xl mx-auto mt-10 px-6">
        <div className="bg-white rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 shadow-2xl relative overflow-hidden border border-slate-200">
          
          {/* 1. Decorative Gradient Background (Moved to sit behind text) */}
          <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-blue-100/50 to-transparent z-0 pointer-events-none"></div>
          
          {/* 2. NEW: LEFT SIDE - Drone Image Container */}
          <div className="w-full md:w-1/3 relative z-10 flex justify-center items-center">
            {/* Ensure you have img-drone.png in public folder */}
            <img 
              src="/assets/tello.png" 
              alt="Tello Drone" 
              className="w-48 h-auto object-contain drop-shadow-xl transform hover:-rotate-3 transition-transform duration-300"
            />
          </div>
          
          {/* 3. MODIFIED: RIGHT SIDE - Text and Progress Content */}
          <div className="relative z-10 flex-1 w-full md:pl-4">
            <div className="flex items-center gap-3 mb-2">
               <h2 className="text-3xl font-extrabold text-tello-dark">Flight Status</h2>
               <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                 Level {completedCount + 1}
               </span>
            </div>
            <p className="text-slate-500 mb-8 text-lg">
              Ready for takeoff, Pilot {username}. You have completed <strong>{completedCount} of {totalCount}</strong> missions.
            </p>
            
            {/* Progress Bar with label */}
            <div className="flex justify-between text-sm font-bold text-slate-600 mb-2">
              <span>Mission Progress</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-slate-200 h-4 rounded-full overflow-hidden shadow-inner">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-400 h-full rounded-full transition-all duration-1000 ease-out relative"
                style={{ width: `${progressPercentage}%` }}
              >
                  {/* Shiny effect on bar */}
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-white/30"></div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modules Grid */}
      <div className="max-w-6xl mx-auto mt-12 px-6">
        <div className="flex items-center gap-4 mb-8">
           <h2 className="text-2xl font-bold text-white">Available Missions</h2>
           <div className="h-[1px] bg-slate-700 flex-1"></div>
        </div>

        {/* DYNAMIC MODULE LIST */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <ModuleCard 
              key={String(module.id)} 
              module={module}
              onStart={handleStartMission}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
