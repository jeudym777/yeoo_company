import React, { useState, useEffect } from 'react';
import type { Agent } from '../types';
import { agentService } from '../services/agent-service';
import { avatarService } from '../services/avatar';
import { Search, X, Save, Trash2, Plus, Edit3, User, Check, AlertCircle, Loader2 } from 'lucide-react';

interface AgentManagerModalProps {
  onClose: () => void;
  onAgentsChanged: () => void;
}

const EMPTY_AGENT: Agent = {
  id: '',
  name: '',
  firstName: '',
  lastName: '',
  emoji: '🤖',
  division: '',
  description: '',
  expertise: [],
  deliverables: [],
  prompt: '',
  gender: undefined,
  avatarUrl: '',
};

const DIVISIONS = ['Executive', 'Engineering', 'AI & Data', 'Design', 'Product', 'Marketing'];

export const AgentManagerModal: React.FC<AgentManagerModalProps> = ({ onClose, onAgentsChanged }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState('');
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    await agentService.seedDefaultAgents();
    const all = await agentService.getAllAgents();
    setAgents(all);
    setLoading(false);
  };

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.division.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (agent: Agent) => {
    setEditingAgent({ ...agent });
    setDeleteConfirm(null);
  };

  const handleNew = () => {
    const newAgent: Agent = {
      ...EMPTY_AGENT,
      id: `agent-${Date.now()}`,
    };
    setEditingAgent(newAgent);
  };

  const handleFieldChange = (field: keyof Agent, value: any) => {
    if (!editingAgent) return;
    setEditingAgent({ ...editingAgent, [field]: value });
  };

  const handleArrayField = (field: 'expertise' | 'deliverables', index: number, value: string) => {
    if (!editingAgent) return;
    const arr = [...editingAgent[field]];
    arr[index] = value;
    handleFieldChange(field, arr);
  };

  const handleAddArrayItem = (field: 'expertise' | 'deliverables') => {
    if (!editingAgent) return;
    handleFieldChange(field, [...editingAgent[field], '']);
  };

  const handleRemoveArrayItem = (field: 'expertise' | 'deliverables', index: number) => {
    if (!editingAgent) return;
    const arr = editingAgent[field].filter((_, i) => i !== index);
    handleFieldChange(field, arr);
  };

  const handleSave = async () => {
    if (!editingAgent || !editingAgent.name.trim()) return;
    setSaving(true);

    try {
      const { supabase } = await import('../services/supabase');
      const row = {
        id: editingAgent.id,
        name: editingAgent.name,
        first_name: editingAgent.firstName,
        last_name: editingAgent.lastName,
        emoji: editingAgent.emoji || '🤖',
        division: editingAgent.division,
        description: editingAgent.description,
        expertise: editingAgent.expertise,
        deliverables: editingAgent.deliverables,
        prompt: editingAgent.prompt,
        avatar_url: editingAgent.avatarUrl || '',
        gender: editingAgent.gender || null,
        context: '',
      };

      await supabase.from('agents').upsert(row, { onConflict: 'id' });
      agentService.clearCache();
      await loadAgents();
      setSavedId(editingAgent.id);
      setTimeout(() => setSavedId(null), 2000);
      setEditingAgent(null);
    } catch (e) {
      alert('Error saving agent to Supabase. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (agentId: string) => {
    try {
      const { supabase } = await import('../services/supabase');
      await supabase.from('agents').delete().eq('id', agentId);
      agentService.clearCache();
      await loadAgents();
      setDeleteConfirm(null);
      if (editingAgent?.id === agentId) setEditingAgent(null);
    } catch {
      alert('Error deleting agent from Supabase.');
    }
  };

  const inputClass = "w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg p-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-red-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <User size={22} className="text-red-400" />
            <h2 className="text-xl font-bold text-white">Agent Manager</h2>
            <span className="text-sm text-slate-500">({agents.length} agents)</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNew}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              <Plus size={16} />
              New Agent
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl cursor-pointer">
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* List */}
          <div className="w-72 border-r border-slate-700 flex flex-col">
            <div className="p-3 border-b border-slate-800">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search agents..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-red-400" />
                </div>
              ) : (
                filteredAgents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleEdit(agent)}
                    className={`w-full text-left p-2.5 rounded-lg transition flex items-center gap-2 ${
                      editingAgent?.id === agent.id
                        ? 'bg-red-500/10 border border-red-500/30'
                        : 'hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <img
                      src={avatarService.getAvatarUrl(agent.id, agent.gender, agent.firstName, agent.lastName)}
                      alt={agent.name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{agent.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{agent.division}</p>
                    </div>
                    {savedId === agent.id && <Check size={14} className="text-green-400" />}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-y-auto p-6">
            {editingAgent ? (
              <div className="max-w-3xl mx-auto space-y-5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-4xl">{editingAgent.emoji || '🤖'}</div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Edit Agent</h3>
                    <p className="text-xs text-slate-500">{editingAgent.id}</p>
                  </div>
                </div>

                {/* Row: Name fields */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Name</label>
                    <input className={inputClass} value={editingAgent.name} onChange={(e) => handleFieldChange('name', e.target.value)} placeholder="e.g. Alejandro Castillo" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">First Name</label>
                    <input className={inputClass} value={editingAgent.firstName} onChange={(e) => handleFieldChange('firstName', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Last Name</label>
                    <input className={inputClass} value={editingAgent.lastName} onChange={(e) => handleFieldChange('lastName', e.target.value)} />
                  </div>
                </div>

                {/* Row: Emoji + Division + Gender */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Emoji</label>
                    <input className={inputClass} value={editingAgent.emoji} onChange={(e) => handleFieldChange('emoji', e.target.value)} placeholder="🤖" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Division</label>
                    <select className={inputClass} value={editingAgent.division} onChange={(e) => handleFieldChange('division', e.target.value)}>
                      <option value="">Select division</option>
                      {DIVISIONS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Gender</label>
                    <select className={inputClass} value={editingAgent.gender || ''} onChange={(e) => handleFieldChange('gender', e.target.value || undefined)}>
                      <option value="">Not specified</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Description</label>
                  <textarea
                    className={`${inputClass} resize-none`}
                    rows={2}
                    value={editingAgent.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder="Brief description of this agent's role..."
                  />
                </div>

                {/* Prompt */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">System Prompt</label>
                  <textarea
                    className={`${inputClass} resize-none font-mono`}
                    rows={6}
                    value={editingAgent.prompt}
                    onChange={(e) => handleFieldChange('prompt', e.target.value)}
                    placeholder="You are... full system prompt for this agent..."
                  />
                </div>

                {/* Expertise */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Expertise</label>
                  <div className="space-y-1.5">
                    {editingAgent.expertise.map((exp, idx) => (
                      <div key={idx} className="flex gap-1.5">
                        <input
                          className={`${inputClass} flex-1`}
                          value={exp}
                          onChange={(e) => handleArrayField('expertise', idx, e.target.value)}
                          placeholder="e.g. React, TypeScript..."
                        />
                        <button
                          onClick={() => handleRemoveArrayItem('expertise', idx)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => handleAddArrayItem('expertise')}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition cursor-pointer"
                    >
                      <Plus size={12} /> Add expertise
                    </button>
                  </div>
                </div>

                {/* Deliverables */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Deliverables</label>
                  <div className="space-y-1.5">
                    {editingAgent.deliverables.map((del, idx) => (
                      <div key={idx} className="flex gap-1.5">
                        <input
                          className={`${inputClass} flex-1`}
                          value={del}
                          onChange={(e) => handleArrayField('deliverables', idx, e.target.value)}
                          placeholder="e.g. Web Apps, APIs..."
                        />
                        <button
                          onClick={() => handleRemoveArrayItem('deliverables', idx)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => handleAddArrayItem('deliverables')}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition cursor-pointer"
                    >
                      <Plus size={12} /> Add deliverable
                    </button>
                  </div>
                </div>

                {/* Avatar URL */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Avatar URL (optional)</label>
                  <input className={inputClass} value={editingAgent.avatarUrl || ''} onChange={(e) => handleFieldChange('avatarUrl', e.target.value)} placeholder="https://..." />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-slate-700">
                  <button
                    onClick={() => { setDeleteConfirm(editingAgent.id); }}
                    className="flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => setEditingAgent(null)}
                    className="bg-slate-800 text-slate-400 border border-slate-700 hover:text-white px-6 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !editingAgent.name.trim()}
                    className="bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition cursor-pointer"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Saving...' : 'Save to Supabase'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <User size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Select or create an agent</p>
                  <p className="text-sm">Click an agent from the list or press "New Agent"</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation */}
        {deleteConfirm && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-60">
            <div className="bg-slate-900 border border-red-500/30 rounded-xl p-6 max-w-sm shadow-2xl">
              <div className="flex items-center gap-2 text-red-400 mb-4">
                <AlertCircle size={20} />
                <h3 className="font-bold">Delete Agent</h3>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Are you sure you want to delete this agent? This will remove it from Supabase permanently.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="bg-slate-800 text-slate-400 px-4 py-2 rounded-lg text-sm transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};