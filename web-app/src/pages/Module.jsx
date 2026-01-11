import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Play, FileText, Code, Home, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';

// 1. IMPORT BOTH MODULE_CONTENT (Text/Video) AND modules (Answers)
import { MODULE_CONTENT, modules } from '../data/moduleData.jsx';

export default function Module() {
  // Cleaned up ID retrieval
  const { moduleId } = useParams();
  const navigate = useNavigate();
  
  // Parse ID securely
  const safeId = moduleId ? String(moduleId).trim() : "default";
  const currentModuleId = parseInt(moduleId) || 1;

  // 2. RETRIEVE CORRECT ANSWER DATA
  // We find the specific module object that contains the 'correctAnswer' string
  const currentModuleData = modules.find(m => m.id === currentModuleId);
  
  // State Management
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState('Pilot');
  const [userId, setUserId] = useState(null); // Store user DB ID
  const [code, setCode] = useState(""); // The actual code in the editor
  const [loading, setLoading] = useState(false);
  
  // Editor Refs
  const lineNumbersRef = useRef(null);
  const [validation, setValidation] = useState({ isValid: true, message: "System Ready" });

  // Calculate Line Numbers
  const lineNumbers = useMemo(() => {
    return code ? code.split('\n').map((_, i) => i + 1) : [1];
  }, [code]);

  // --- PRE-FLIGHT CHECKS (Real-time Syntax Validation) ---
  useEffect(() => {
    const checkCode = () => {
      // 1. Safety Check (Block dangerous imports)
      const forbidden = ['import os', 'import sys', 'subprocess', 'eval(', 'exec('];
      for (let word of forbidden) {
        if (code.includes(word)) {
          return { isValid: false, message: `SECURITY ALERT: "${word}" is forbidden.` };
        }
      }

      // 2. Logic Check (Must Connect) - Only applies if module requires connection
      // You can make this conditional based on currentModuleData.requiresConnection if you want
      if (!code.includes('Tello()')) {
        return { isValid: false, message: "Missing drone initialization: 'drone = Tello()'" };
      }
      if (!code.includes('.connect()')) {
        return { isValid: false, message: "Missing connection command: 'drone.connect()'" };
      }
      
      // 3. Syntax Heuristic
      const lines = code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if ((trimmed.startsWith('def ') || trimmed.startsWith('if ') || trimmed.startsWith('for ') || trimmed.startsWith('while ')) && !trimmed.endsWith(':')) {
           return { isValid: false, message: `Syntax Error on Line ${i+1}: Missing ':'` };
        }
      }

      return { isValid: true, message: "Pre-Flight Checks Passed. Ready to Execute." };
    };

    setValidation(checkCode());
  }, [code]);

  // Sync Scroll for Line Numbers
  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Content Retrieval for UI (Title, Video, Docs)
  const content = (MODULE_CONTENT && MODULE_CONTENT[safeId]) 
    ? MODULE_CONTENT[safeId] 
    : (MODULE_CONTENT && MODULE_CONTENT["default"]) || { title: 'Missing', videoUrl: '', docs: '', defaultCode: '' };

  // Set Default Code on Load
  useEffect(() => {
    setCode(content.defaultCode || '');
  }, [content]);

  // Load User Info from Database
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
        console.log('[MODULE] Loading user data for:', storedUsername);
        setUsername(storedUsername);
        
        // Fetch user data from backend to get the ID
        fetch(`http://127.0.0.1:8000/api/auth/me/${storedUsername}`)
          .then(res => {
            if (!res.ok) {
              throw new Error('Failed to fetch user data');
            }
            return res.json();
          })
          .then(data => {
            console.log('✅ [MODULE] User data fetched from database:', data);
            setUserId(data.id);
          })
          .catch(err => {
            console.error('❌ [MODULE] Failed to fetch user data:', err);
            // Fallback
            setUserId("unknown");
          });
    }
  }, []);

  const nextStep = () => { if (step < 2) setStep(step + 1); };
  const prevStep = () => { if (step > 0) setStep(step - 1); };

  // --- 3. EXECUTION LOGIC (Step 3) ---
  const handleExecute = async () => {
    setLoading(true);
    
    console.log('[MODULE] Executing mission for Module:', currentModuleId);
    console.log('[MODULE] User ID:', userId);

    // Safety: Ensure module data exists
    if (!currentModuleData) {
        console.error('[MODULE] Module data not found for module:', currentModuleId);
        alert("System Error: Module data not found.");
        setLoading(false);
        return;
    }

    // A. NORMALIZE STRINGS
    // We trim whitespace to be forgiving of extra newlines at start/end
    const userSubmission = code.trim();
    const solution = currentModuleData.correctAnswer.trim();

    console.log('[MODULE] Comparing code:');
    console.log('  User submission:', userSubmission);
    console.log('  Expected answer:', solution);

    // B. COMPARE SUBMISSION VS ANSWER
    // Note: For stricter python checking, you might eventually want to send code to backend to run it.
    // For now, we do string comparison as requested.
    const isCorrect = userSubmission === solution;
    
    console.log('[MODULE] Code validation result:', isCorrect ? '✅ PASS' : '❌ FAIL');

    if (isCorrect) {
      // SUCCESS SCENARIO
      console.log('[MODULE] Submitting progress update to backend...');
      try {
        // 1. Update Backend
        const response = await fetch('http://localhost:8000/api/update-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId, 
            module_id: currentModuleId
          })
        });

        const result = await response.json();
        console.log('✅ [MODULE] Progress updated successfully:', result);
        console.log(`[MODULE] Next module unlocked: ${result.next_module_unlocked}`);

        // 2. Alert User with success message
        // Using a timeout so the UI update (loading spinner) renders before the alert freezes it
        setTimeout(() => {
            const nextModuleNum = parseInt(result.next_module_unlocked);
            let successMessage = `🎉 Mission Passed!\n\nModule ${currentModuleId} Complete!`;
            
            if (nextModuleNum <= 5) {
              successMessage += `\n\n🔓 Module ${nextModuleNum} has been UNLOCKED!`;
            } else {
              successMessage += `\n\n🎓 Congratulations! You have completed Module ${currentModuleId}!`;
            }
            
            alert(successMessage);
            console.log('[MODULE] Navigating back to dashboard...');
            navigate('/dashboard'); 
        }, 100);

      } catch (error) {
        console.error("❌ [MODULE] Error saving progress:", error);
        alert("Mission Passed, but network error occurred saving progress.");
        navigate('/dashboard');
      }
    } else {
      // FAILURE SCENARIO
      console.log('[MODULE] Mission failed - code does not match solution');
      setTimeout(() => {
          alert("❌ Mission Failed: Code does not match mission parameters.\n\nCheck your variables and print statements.");
          setLoading(false);
      }, 100);
    }
  };

  return (
    <div className="h-screen bg-tello-dark flex flex-col overflow-hidden relative">
      
      {/* HEADER */}
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

      {/* MAIN CONTENT */}
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
              <div className="bg-slate-800 p-5 pl-20 border-b border-slate-700 flex items-center gap-3"><Play className="text-blue-500" /><h2 className="text-white font-bold text-lg">Step 1: Mission Briefing</h2></div>
              <div className="flex-1 bg-black flex items-center justify-center relative">{content.videoUrl ? <iframe width="100%" height="100%" src={content.videoUrl} title="Video" frameBorder="0" allowFullScreen className="w-full h-full pointer-events-auto"></iframe> : <div className="text-slate-500">No Video Available</div>}</div>
          </div>

          {/* CARD 2: DOCS */}
          <div className={`absolute inset-0 w-full h-full bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-700 ease-in-out ${step === 1 ? 'opacity-100 translate-x-0 z-20' : step < 1 ? 'opacity-0 translate-x-96 z-0' : 'opacity-0 -translate-x-96 z-10'}`}>
              <div className="bg-slate-100 p-5 pl-20 border-b border-slate-200 flex items-center gap-3"><FileText className="text-orange-500" /><h2 className="text-slate-800 font-bold text-lg">Step 2: Documentation</h2></div>
              <div className="flex-1 p-10 overflow-y-auto prose lg:prose-xl max-w-none"><h3 className="text-3xl font-bold text-slate-800 mb-6">{content.title}</h3><div className="whitespace-pre-wrap text-slate-600 leading-loose text-lg">{content.docs}</div></div>
          </div>

          {/* CARD 3: CODE */}
          <div className={`absolute inset-0 w-full h-full bg-[#1e1e1e] rounded-3xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden transition-all duration-700 ease-in-out ${step === 2 ? 'opacity-100 translate-x-0 z-20' : 'opacity-0 translate-x-96 z-0'}`}>
              
              {/* Toolbar */}
              <div className="bg-[#2d2d2d] p-4 pl-20 border-b border-black flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <Code className="text-green-500" />
                    <h2 className="text-slate-200 font-bold text-lg">Step 3: Flight Computer</h2>
                </div>
                <button 
                  onClick={handleExecute}
                  // Disable if syntax is invalid OR if network is currently loading
                  disabled={!validation.isValid || loading} 
                  className={`px-6 py-2.5 rounded-lg font-bold text-sm transition flex items-center gap-2 shadow-lg active:scale-95
                    ${validation.isValid && !loading
                      ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/20' 
                      : 'bg-slate-600 text-slate-400 cursor-not-allowed'}`}
                >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {loading ? "EXECUTING..." : "EXECUTE MISSION"}
                </button>
              </div>

              {/* Editor */}
              <div className="flex-1 flex relative overflow-hidden">
                <div ref={lineNumbersRef} className="w-12 bg-[#252525] border-r border-[#333] text-slate-500 text-right font-mono text-sm py-4 pr-3 select-none overflow-hidden">
                  {lineNumbers.map((num) => (<div key={num} className="leading-6">{num}</div>))}
                </div>
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

              {/* STATUS BAR */}
              <div className={`h-12 border-t border-black flex items-center px-6 gap-3 font-mono text-xs
                  ${validation.isValid ? 'bg-[#1e1e1e] text-green-500' : 'bg-red-900/20 text-red-400'}`}>
                  
                  {validation.isValid 
                    ? <CheckCircle className="w-4 h-4" /> 
                    : <AlertCircle className="w-4 h-4" />
                  }
                  
                  <span className="uppercase tracking-wider font-bold">
                    {validation.isValid ? "SYSTEM READY" : "COMPILE ERROR"}:
                  </span>
                  <span className="flex-1 truncate">{validation.message}</span>
              </div>

          </div>

        </div>
      </div>
    </div>
  );
}