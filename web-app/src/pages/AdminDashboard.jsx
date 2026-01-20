import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, BookOpen, Trash2, Plus, LogOut, Save, Image as ImageIcon, Video, FileText } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('modules'); // Default to modules for easier testing
  const [users, setUsers] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [editingModule, setEditingModule] = useState(null); 

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') {
      alert("Unauthorized");
      navigate('/login');
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, modulesRes] = await Promise.all([
          fetch('http://127.0.0.1:8000/api/admin/users'),
          fetch('http://127.0.0.1:8000/api/modules')
      ]);
      
      const usersData = await usersRes.json();
      const modulesData = await modulesRes.json();
      
      setUsers(usersData);
      // Sort modules by ID so the list looks right
      setModules(modulesData.sort((a, b) => parseInt(a.id) - parseInt(b.id)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- HELPER: AUTO-INCREMENT ID ---
  const getNextId = () => {
    if (modules.length === 0) return "1";
    // Find max ID
    const maxId = Math.max(...modules.map(m => parseInt(m.id) || 0));
    return String(maxId + 1);
  };

  // --- ACTIONS ---
  const handleAddNewClick = () => {
    setEditingModule({ 
        id: getNextId(), // Auto-set to next number
        title: "", 
        description: "", 
        docs: "", 
        video_url: "", 
        image_data: "", // This will store the Image Link
        is_active: true 
    });
  };

  const handleEditClick = (mod) => {
    // Populate form with existing data
    setEditingModule({
        ...mod,
        image_data: mod.image_data || "" 
    });
  };

  const handleSaveModule = async (e) => {
    e.preventDefault();
    try {
        await fetch('http://127.0.0.1:8000/api/admin/modules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingModule)
        });
        setEditingModule(null);
        fetchData(); // Refresh list
    } catch (err) {
        alert("Failed to save module");
    }
  };

  const handleDeleteModule = async (id) => {
    if(!window.confirm(`Delete Module ${id}? This cannot be undone.`)) return;
    await fetch(`http://127.0.0.1:8000/api/admin/modules/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleDeleteUser = async (id) => {
    if(!window.confirm("Delete this user?")) return;
    await fetch(`http://127.0.0.1:8000/api/admin/users/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (loading) return <div className="text-white p-10">Loading Admin Panel...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-800 p-6 flex flex-col border-r border-slate-700 shrink-0">
        <h1 className="text-2xl font-bold text-white mb-8 tracking-tight">Admin Console</h1>
        
        <nav className="flex-1 flex flex-col gap-2">
          <button onClick={() => setActiveTab('modules')} className={`p-3 rounded-lg flex items-center gap-3 transition ${activeTab === 'modules' ? 'bg-blue-600 shadow-md' : 'hover:bg-slate-700'}`}>
            <BookOpen size={20} /> Modules
          </button>
          <button onClick={() => setActiveTab('users')} className={`p-3 rounded-lg flex items-center gap-3 transition ${activeTab === 'users' ? 'bg-blue-600 shadow-md' : 'hover:bg-slate-700'}`}>
            <Users size={20} /> Learners
          </button>
        </nav>

        <button onClick={handleLogout} className="p-3 rounded-lg flex items-center gap-3 hover:bg-red-900/30 text-red-400 mt-auto transition">
          <LogOut size={20} /> Logout
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 overflow-y-auto h-screen">
        
        {/* === MODULES TAB === */}
        {activeTab === 'modules' && (
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold">Manage Modules</h2>
                <button 
                  onClick={handleAddNewClick} 
                  className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-lg transition transform active:scale-95 font-semibold"
                >
                    <Plus size={20} /> Add Module
                </button>
            </div>

            {/* EDIT/CREATE FORM */}
            {editingModule && (
                <div className="bg-slate-800 p-8 rounded-2xl border border-blue-500/50 shadow-2xl mb-10 animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-400">
                        {modules.find(m => m.id === editingModule.id) ? 'Edit Module' : 'Create New Module'}
                    </h3>
                    
                    <form onSubmit={handleSaveModule} className="grid gap-6">
                        
                        {/* Row 1: ID & Title */}
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">ID</label>
                                <input 
                                    type="text" 
                                    value={editingModule.id} 
                                    readOnly 
                                    className="w-full bg-slate-900/50 p-3 rounded border border-slate-700 text-slate-500 cursor-not-allowed font-mono text-center" 
                                />
                            </div>
                            <div className="md:col-span-5">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Module Title</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Advanced Swarm Logic" 
                                    value={editingModule.title} 
                                    onChange={e => setEditingModule({...editingModule, title: e.target.value})} 
                                    className="w-full bg-slate-900 p-3 rounded border border-slate-600 focus:border-blue-500 outline-none transition" 
                                    required 
                                />
                            </div>
                        </div>

                        {/* Row 2: Description */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Short Description (Card View)</label>
                            <textarea 
                                placeholder="Brief summary shown on the dashboard card..." 
                                value={editingModule.description} 
                                onChange={e => setEditingModule({...editingModule, description: e.target.value})} 
                                className="w-full bg-slate-900 p-3 rounded border border-slate-600 focus:border-blue-500 outline-none h-20 resize-none transition" 
                                required
                            ></textarea>
                        </div>

                        {/* Row 3: Documentation (Large) */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-2">
                                <FileText size={14}/> Full Documentation (Markdown supported)
                            </label>
                            <textarea 
                                placeholder="# Mission Briefing\n\nExplain the mission details here..." 
                                value={editingModule.docs || ""} 
                                onChange={e => setEditingModule({...editingModule, docs: e.target.value})} 
                                className="w-full bg-slate-900 p-4 rounded border border-slate-600 focus:border-blue-500 outline-none h-64 font-mono text-sm leading-relaxed" 
                            ></textarea>
                        </div>

                        {/* Row 4: Media Links */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-2">
                                    <Video size={14}/> Video URL (Embed Link)
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="https://www.youtube.com/embed/..." 
                                    value={editingModule.video_url || ""} 
                                    onChange={e => setEditingModule({...editingModule, video_url: e.target.value})} 
                                    className="w-full bg-slate-900 p-3 rounded border border-slate-600 focus:border-blue-500 outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-2">
                                    <ImageIcon size={14}/> Image Link (URL)
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="https://example.com/drone-image.png" 
                                    value={editingModule.image_data || ""} 
                                    onChange={e => setEditingModule({...editingModule, image_data: e.target.value})} 
                                    className="w-full bg-slate-900 p-3 rounded border border-slate-600 focus:border-blue-500 outline-none" 
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 mt-4 border-t border-slate-700 pt-6">
                            <button 
                                type="button" 
                                onClick={() => setEditingModule(null)} 
                                className="px-5 py-2 text-slate-400 hover:bg-slate-700 hover:text-white rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition"
                            >
                                <Save size={18} /> Save Module
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODULE LIST */}
            <div className="grid gap-4">
                {modules.map(mod => (
                    <div key={mod.id} className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex justify-between items-center hover:border-slate-500 transition group">
                        <div className="flex gap-4 items-center">
                            <div className="bg-slate-900 w-12 h-12 rounded-lg flex items-center justify-center font-bold text-blue-500 border border-slate-700">
                                {mod.id}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition">{mod.title}</h3>
                                <p className="text-slate-400 text-sm max-w-md truncate">{mod.description}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleEditClick(mod)} className="px-4 py-2 bg-slate-700 hover:bg-blue-600 hover:text-white text-slate-300 rounded-lg transition text-sm font-medium">
                                Edit
                            </button>
                            <button onClick={() => handleDeleteModule(mod.id)} className="p-2 bg-slate-800 hover:bg-red-900/50 text-slate-500 hover:text-red-400 rounded-lg transition">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}

        {/* === USERS TAB === */}
        {activeTab === 'users' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8">Manage Users</h2>
            <div className="bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700">
              <table className="w-full text-left">
                <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="p-4">Username</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-t border-slate-700 hover:bg-slate-700/30 transition">
                      <td className="p-4 font-bold text-white">{user.username}</td>
                      <td className="p-4 text-slate-400">{user.email}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${user.role === 'admin' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-green-500/20 text-green-300 border border-green-500/30'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {user.role !== 'admin' && (
                          <button onClick={() => handleDeleteUser(user.id)} className="text-slate-500 hover:text-red-400 hover:bg-red-900/20 p-2 rounded transition">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}