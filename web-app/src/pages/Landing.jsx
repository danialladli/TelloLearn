import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Users, Zap } from 'lucide-react';

export default function Landing() {
  useEffect(() => {
    // Clear all localStorage on landing page load
    console.log('[LANDING] Clearing all localStorage data');
    localStorage.clear();
    console.log('[LANDING] localStorage cleared successfully');
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-10 py-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-tello-dark">TelloLearn</h1>
        <div className="flex gap-6 items-center font-medium">
          <a href="#modules" className="hover:text-tello-accent">Modules</a>
          <a href="#contact" className="hover:text-tello-accent">Contact Us</a>
          <Link to="/login" className="bg-tello-dark text-white px-5 py-2 rounded-full hover:bg-slate-800 transition">
            Log In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative bg-slate-100 mt-4 mx-4 rounded-3xl overflow-hidden h-[500px] flex items-center">
        {/* Background Image Overlay would go here */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-200 to-transparent z-0"></div>
        
        <div className="relative z-10 max-w-2xl px-12">
          <h2 className="text-5xl font-extrabold text-tello-dark mb-6 leading-tight">
            Get started! <br/>
            <span className="text-3xl font-medium text-slate-600">Unlock your drone programming journey.</span>
          </h2>
          <p className="text-lg text-slate-500 mb-8 max-w-md">
            Master progressive modules from basic flight to swarm intelligence with our proven step-by-step curriculum.
          </p>
          <Link to="/signup" className="bg-tello-dark text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-slate-800 transition shadow-lg">
            Start Now
          </Link>
        </div>
        
        {/* Drone Image (Right Side) */}
        <div className="absolute right-[-20px] lg:right-[-50px] top-1/2 -translate-y-1/2 w-[350px] md:w-[450px] lg:w-[550px] pointer-events-none">
            <img 
                src="/assets/tello.png" 
                alt="Tello Drone" 
                className="w-full h-auto drop-shadow-2xl" 
            />
        </div>
      </header>

      {/* Stats / Features Grid */}
      <section className="py-16 max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        <div className="bg-white p-8 rounded-2xl border-2 border-slate-100 shadow-sm hover:shadow-md transition">
          <div className="text-4xl font-extrabold text-tello-dark mb-2">20,000 ++</div>
          <p className="text-slate-500">students enrolling in this powerful drone programming platform.</p>
        </div>
        <div className="bg-white p-8 rounded-2xl border-2 border-slate-100 shadow-sm hover:shadow-md transition">
          <div className="text-4xl font-extrabold text-tello-dark mb-2">FREE</div>
          <p className="text-slate-500">course for all beloved users to master their way to become drone specialists.</p>
        </div>
        <div className="bg-white p-8 rounded-2xl border-2 border-slate-100 shadow-sm hover:shadow-md transition">
          <div className="text-4xl font-extrabold text-tello-dark mb-2">Easy</div>
          <p className="text-slate-500">to understand modules with progressive skill acquisition.</p>
        </div>
      </section>
    </div>
  );
}