import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Play, FileText, Code, Home, AlertCircle, CheckCircle } from 'lucide-react';
import { MODULE_CONTENT } from '../../assets/strings/moduleStrings';
import { API_URL, apiFetch } from '../config';

export default function Module() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const safeId = moduleId ? String(moduleId).trim() : "1";

  // --- STATE ---
  const [moduleData, setModuleData] = useState(null); 
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState('Pilot');
  const [userId, setUserId] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(true);

  const lineNumbersRef = useRef(null);
  const [validation, setValidation] = useState({ isValid: true, message: "System Ready" });

  // --- 1. LOAD MODULE DATA (cache-first, API fallback) ---
  useEffect(() => {
    const localContent = MODULE_CONTENT.find(m => String(m.id) === String(safeId));

    // Helper: apply local strings override and commit to state
    const applyAndSet = (mod) => {
        if (localContent) {
            mod.docs = localContent.docs;
            if (localContent.default_code) mod.default_code = localContent.default_code;
        }
        setModuleData(mod);
        setCode(mod.default_code || '');
    };

    // 1. Try the Dashboard cache first — renders the page instantly
    try {
        const cached = localStorage.getItem('cached_modules');
        if (cached) {
            const cachedMod = JSON.parse(cached).find(m => String(m.id) === String(safeId));
            if (cachedMod) {
                applyAndSet({ ...cachedMod });
                setContentLoading(false);
                // Modules 1-5 have local docs/code — no API call needed
                if (localContent) return;
            }
        }
    } catch (_) { /* corrupt cache — fall through to API */ }

    // 2. Cache miss or admin module (6+) — must fetch from API
    setContentLoading(true);
    const fetchFromAPI = async () => {
        try {
            const res = await apiFetch(`${API_URL}/api/modules`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const allModules = await res.json();
            const currentMod = allModules.find(m => String(m.id) === String(safeId));
            if (currentMod) {
                applyAndSet(currentMod);
            } else {
                console.error('[MODULE] Module not found for ID:', safeId);
                setModuleData(null);
            }
        } catch (error) {
            console.error('[MODULE] Failed to fetch module data:', error);
            // Only wipe the screen if nothing was rendered from cache
            setModuleData(prev => prev ?? null);
        } finally {
            setContentLoading(false);
        }
    };
    fetchFromAPI();
  }, [safeId]);

  // --- 2. LOAD USER DATA FROM LOCAL STORAGE (no API call needed) ---
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedUserId   = localStorage.getItem('user_id');
    if (storedUsername) setUsername(storedUsername);
    if (storedUserId)   setUserId(storedUserId);
  }, []);

  // --- 3. LINE NUMBERS ---
  const lineNumbers = useMemo(() => {
    return code ? code.split('\n').map((_, i) => i + 1) : [1];
  }, [code]);

  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // --- 4. VALIDATION ---
  useEffect(() => {
    if (!code) return;
    const checkCode = () => {
      const forbidden = ['import os', 'import sys', 'subprocess', 'eval(', 'exec('];
      for (let word of forbidden) {
        if (code.includes(word)) return { isValid: false, message: `SECURITY ALERT: "${word}" is forbidden.` };
      }
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

  // --- 5. EXECUTE MISSION (AI VALIDATION) ---
  const handleExecute = async () => {
    if (!moduleData) return;
    setLoading(true);
    
    try {
      // 1. Send the code to the Gemini AI Backend for validation
      console.log(`[SYSTEM] Sending code to AI Tutor for Module ${safeId}...`);
      const validateResponse = await apiFetch(`${API_URL}/api/validate_code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: String(userId), 
          module_id: `module${safeId}`, 
          code: code 
        })
      });
      
      const validationResult = await validateResponse.json();

      // 2. Evaluate the AI's Decision
      if (validationResult.is_correct) {
        
        // 3. Silently update the database progress first
        try {
            const progressResponse = await apiFetch(`${API_URL}/api/update-progress`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: userId, module_id: parseInt(safeId) })
            });
            const progressResult = await progressResponse.json();

            // 4. Combine EVERYTHING into ONE single alert popup to prevent browser blocking
            let combinedMessage = `🎉 AI TUTOR APPROVED!\n\n${validationResult.feedback}\n\n✅ Mission ${safeId} Complete!`;
            
            // Check if the next module was returned safely
            if (progressResult.next_module_unlocked && parseInt(progressResult.next_module_unlocked) <= 5) {
                combinedMessage += `\n🔓 Module ${progressResult.next_module_unlocked} UNLOCKED!`;
            }

            alert(combinedMessage);
            navigate('/dashboard'); // Navigate instantly after they click OK!

        } catch (dbError) {
            console.error("Database Sync Error:", dbError);
            alert(`🎉 AI TUTOR APPROVED!\n\n${validationResult.feedback}\n\n(Warning: Failed to sync progress to dashboard)`);
            navigate('/dashboard'); 
        }

      } else {
        // AI found a logic error! Show the hint.
        alert(`💡 AI TUTOR HINT:\n\n${validationResult.feedback}`);
        setLoading(false); // Turn off the spinner so they can edit their code
      }

    } catch (error) {
      console.error("Error communicating with AI Tutor:", error);
      alert("Network error: Could not reach the AI validation server.");
      setLoading(false);
    }
  };

  if (contentLoading) {
      return <div className="h-screen bg-tello-dark flex items-center justify-center text-white">Loading Mission Data...</div>;
  }

  // ERROR UI
  if (!moduleData) {
      return (
        <div className="h-screen bg-tello-dark flex flex-col items-center justify-center text-white gap-4 px-6 text-center">
            <h2 className="text-2xl font-bold text-red-400">Cannot Reach Ground Station</h2>
            <p className="text-slate-400 max-w-md">
                The backend tunnel is offline or unreachable. Start your backend and make sure
                the VS Code port forwarding (or ngrok) tunnel is active, then try again.
            </p>
            <div className="flex gap-3 mt-2">
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                >
                    Retry
                </button>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
                >
                    Back to Dashboard
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="h-screen bg-tello-dark flex flex-col overflow-hidden relative">
      <nav className="bg-white/10 backdrop-blur-sm px-6 py-4 flex justify-between items-center border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600 transition group">
            <Home className="text-slate-300 group-hover:text-white w-5 h-5 transition" />
          </button>
          <h1 className="text-xl font-bold text-white">Mission {safeId}: {moduleData.title}</h1>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-slate-300 font-medium">{username}</span>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-5xl h-full max-h-[700px] relative perspective-1000">
          
          <button onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0} className={`absolute top-4 left-4 z-30 p-3 bg-black/50 hover:bg-black/80 rounded-full transition-all ${step === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button onClick={() => step < 2 && setStep(step + 1)} disabled={step === 2} className={`absolute top-4 right-4 z-30 p-3 bg-black/50 hover:bg-black/80 rounded-full transition-all ${step === 2 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <ChevronRight className="w-6 h-6 text-white" />
          </button>

          {/* STEP 1: VIDEO */}
          <div className={`absolute inset-0 w-full h-full bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden transition-all duration-700 ease-in-out ${step === 0 ? 'opacity-100 translate-x-0 z-20' : step > 0 ? 'opacity-0 -translate-x-96 z-10' : 'opacity-0 translate-x-96 z-0'}`}>
              <div className="bg-slate-800 p-5 pl-20 border-b border-slate-700 flex items-center gap-3"><Play className="text-blue-500" /><h2 className="text-white font-bold text-lg">Step 1: Mission Briefing</h2></div>
              <div className="flex-1 bg-black flex items-center justify-center relative">
                  {moduleData.video_url ? (
                      <iframe width="100%" height="100%" src={moduleData.video_url} title="Video" frameBorder="0" allowFullScreen className="w-full h-full pointer-events-auto"></iframe>
                  ) : <div className="text-slate-500">No Video Available</div>}
              </div>
          </div>

          {/* STEP 2: DOCS */}
          <div className={`absolute inset-0 w-full h-full bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-700 ease-in-out ${step === 1 ? 'opacity-100 translate-x-0 z-20' : step < 1 ? 'opacity-0 translate-x-96 z-0' : 'opacity-0 -translate-x-96 z-10'}`}>
              <div className="bg-slate-100 p-5 pl-20 border-b border-slate-200 flex items-center gap-3"><FileText className="text-orange-500" /><h2 className="text-slate-800 font-bold text-lg">Step 2: Documentation</h2></div>
              <div className="flex-1 p-10 overflow-y-auto prose lg:prose-xl max-w-none">
                  <h3 className="text-3xl font-bold text-slate-800 mb-6">{moduleData.title}</h3>
                  <div className="whitespace-pre-wrap text-slate-600 leading-loose text-lg">{moduleData.docs}</div>
              </div>
          </div>

          {/* STEP 3: CODE */}
          <div className={`absolute inset-0 w-full h-full bg-[#1e1e1e] rounded-3xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden transition-all duration-700 ease-in-out ${step === 2 ? 'opacity-100 translate-x-0 z-20' : 'opacity-0 translate-x-96 z-0'}`}>
              <div className="bg-[#2d2d2d] p-4 pl-20 border-b border-black flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3"><Code className="text-green-500" /><h2 className="text-slate-200 font-bold text-lg">Step 3: Flight Computer</h2></div>
                <button onClick={handleExecute} disabled={!validation.isValid || loading} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition flex items-center gap-2 shadow-lg active:scale-95 ${validation.isValid && !loading ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-600 text-slate-400 cursor-not-allowed'}`}>
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Play className="w-4 h-4" />}
                    {loading ? "EXECUTING..." : "EXECUTE MISSION"}
                </button>
              </div>

              <div className="flex-1 flex relative overflow-hidden">
                <div ref={lineNumbersRef} className="w-12 bg-[#252525] border-r border-[#333] text-slate-500 text-right font-mono text-sm py-4 pr-3 select-none overflow-hidden">
                  {lineNumbers.map((num) => (<div key={num} className="leading-6">{num}</div>))}
                </div>
                <textarea 
                    className="flex-1 bg-[#1e1e1e] text-green-400 font-mono text-sm p-4 leading-6 resize-none focus:outline-none whitespace-pre"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onScroll={handleScroll} 
                    spellCheck="false"
                ></textarea>
              </div>
              <div className={`h-12 border-t border-black flex items-center px-6 gap-3 font-mono text-xs ${validation.isValid ? 'bg-[#1e1e1e] text-green-500' : 'bg-red-900/20 text-red-400'}`}>
                  {validation.isValid ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span className="uppercase tracking-wider font-bold">{validation.isValid ? "SYSTEM READY" : "COMPILE ERROR"}:</span>
                  <span className="flex-1 truncate">{validation.message}</span>
              </div>
          </div>

        </div>
      </div>
    </div>
  );
}