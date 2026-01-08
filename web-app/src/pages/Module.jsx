// 1. IMPORT useRef
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Play, FileText, Code, Home } from 'lucide-react';

import { MODULE_CONTENT } from '../data/moduleData.jsx';

export default function Module() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState('Pilot');
  const [code, setCode] = useState('');
  
  // 2. CREATE A REF FOR THE LINE NUMBERS
  const lineNumbersRef = useRef(null);

  const lineNumbers = useMemo(() => {
    return code ? code.split('\n').map((_, i) => i + 1) : [1];
  }, [code]);

  // 3. SYNC SCROLL FUNCTION
  const handleScroll = (e) => {
    // When textarea scrolls, force the line numbers to scroll to the exact same position
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const safeId = moduleId ? String(moduleId).trim() : "default";

  // Safe content retrieval
  const content = (MODULE_CONTENT && MODULE_CONTENT[safeId]) 
    ? MODULE_CONTENT[safeId] 
    : (MODULE_CONTENT && MODULE_CONTENT["default"]) || { title: 'Missing', videoUrl: '', docs: '', defaultCode: '' };

  useEffect(() => {
    setCode(content.defaultCode || '');
  }, [content]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) setUsername(JSON.parse(storedUser).username);
  }, []);

  const nextStep = () => { if (step < 2) setStep(step + 1); };
  const prevStep = () => { if (step > 0) setStep(step - 1); };

  return (
    <div className="h-screen bg-tello-dark flex flex-col overflow-hidden relative">
      
      {/* --- HEADER --- */}
      <nav className="bg-white/10 backdrop-blur-sm px-6 py-4 flex justify-between items-center border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600 transition group">
            <Home className="text-slate-300 group-hover:text-white w-5 h-5 transition" />
          </button>
          <h1 className="text-xl font-bold text-white">Mission {safeId}: {content.title}</h1>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="flex gap-2 mr-8">
                {[0, 1, 2].map(i => (
                    <div key={i} className={`h-2 rounded-full transition-all duration-500 ${step === i ? 'bg-blue-500 w-12' : 'bg-slate-600 w-8'}`}></div>
                ))}
            </div>
            <span className="text-slate-300 font-medium">{username}</span>
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-5xl h-full max-h-[700px] relative perspective-1000">
          
          {/* ARROWS */}
          <button onClick={prevStep} disabled={step === 0} className={`absolute top-4 left-4 z-30 p-3 bg-black/50 hover:bg-black/80 rounded-full transition-all ${step === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button onClick={nextStep} disabled={step === 2} className={`absolute top-4 right-4 z-30 p-3 bg-black/50 hover:bg-black/80 rounded-full transition-all ${step === 2 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <ChevronRight className="w-6 h-6 text-white" />
          </button>

          {/* CARD 1: VIDEO */}
          <div className={`absolute inset-0 w-full h-full bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden transition-all duration-700 ease-in-out ${step === 0 ? 'opacity-100 translate-x-0 z-20' : step > 0 ? 'opacity-0 -translate-x-96 z-10' : 'opacity-0 translate-x-96 z-0'}`}>
              <div className="bg-slate-800 p-5 pl-20 border-b border-slate-700 flex items-center gap-3">
                <Play className="text-blue-500" />
                <h2 className="text-white font-bold text-lg">Step 1: Mission Briefing</h2>
              </div>
              <div className="flex-1 bg-black flex items-center justify-center relative">
                 {content.videoUrl ? (
                   <iframe width="100%" height="100%" src={content.videoUrl} title="Video" frameBorder="0" allowFullScreen className="w-full h-full pointer-events-auto"></iframe>
                 ) : <div className="text-slate-500">No Video Available</div>}
              </div>
          </div>

          {/* CARD 2: DOCS */}
          <div className={`absolute inset-0 w-full h-full bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-700 ease-in-out ${step === 1 ? 'opacity-100 translate-x-0 z-20' : step < 1 ? 'opacity-0 translate-x-96 z-0' : 'opacity-0 -translate-x-96 z-10'}`}>
              <div className="bg-slate-100 p-5 pl-20 border-b border-slate-200 flex items-center gap-3">
                <FileText className="text-orange-500" />
                <h2 className="text-slate-800 font-bold text-lg">Step 2: Documentation</h2>
              </div>
              <div className="flex-1 p-10 overflow-y-auto prose lg:prose-xl max-w-none">
                 <h3 className="text-3xl font-bold text-slate-800 mb-6">{content.title}</h3>
                 <div className="whitespace-pre-wrap text-slate-600 leading-loose text-lg">{content.docs}</div>
              </div>
          </div>

          {/* CARD 3: CODE */}
          <div className={`absolute inset-0 w-full h-full bg-[#1e1e1e] rounded-3xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden transition-all duration-700 ease-in-out ${step === 2 ? 'opacity-100 translate-x-0 z-20' : 'opacity-0 translate-x-96 z-0'}`}>
              <div className="bg-[#2d2d2d] p-4 pl-20 border-b border-black flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <Code className="text-green-500" />
                    <h2 className="text-slate-200 font-bold text-lg">Step 3: Flight Computer</h2>
                </div>
                <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition flex items-center gap-2 shadow-lg shadow-green-900/20 active:scale-95">
                    <Play className="w-4 h-4" /> EXECUTE MISSION
                </button>
              </div>

              {/* EDITOR AREA */}
              <div className="flex-1 flex relative overflow-hidden">
                
                {/* 1. Line Numbers Column (ATTACH REF HERE) */}
                <div 
                  ref={lineNumbersRef}
                  className="w-12 bg-[#252525] border-r border-[#333] text-slate-500 text-right font-mono text-sm py-4 pr-3 select-none overflow-hidden"
                >
                  {lineNumbers.map((num) => (
                    <div key={num} className="leading-6">{num}</div>
                  ))}
                </div>

                {/* 2. Text Area (ATTACH ON SCROLL HERE) */}
                {/* Added whitespace-pre to prevent line wrapping which breaks alignment */}
                <textarea 
                    className="flex-1 bg-[#1e1e1e] text-green-400 font-mono text-sm p-4 leading-6 resize-none focus:outline-none selection:bg-green-900/50 whitespace-pre"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onScroll={handleScroll} 
                    spellCheck="false"
                    autoCapitalize="off"
                    autoComplete="off"
                ></textarea>
                
              </div>
          </div>

        </div>
      </div>
    </div>
  );
}