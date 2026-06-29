import React, { useState, useEffect } from 'react';
import { clientService, type Client } from '../services/client-service';
import { Search, Plus, X, Save, Trash2, Building2, Mail, Phone, User, Briefcase, AlertCircle, Loader2 } from 'lucide-react';

const EMPTY_CLIENT = (): Client => ({
  id: `client-${Date.now()}`,
  name: '',
  company: '',
  email: '',
  phone: '',
  position: '',
  notes: '',
  status: 'lead',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  lead: 'Lead',
  archived: 'Archived',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-500/10 border-green-500/30',
  inactive: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  lead: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  archived: 'text-gray-500 bg-gray-500/10 border-gray-500/30',
};

interface ClientsPanelProps {
  onClose: () => void;
}

export const ClientsPanel: React.FC<ClientsPanelProps> = ({ onClose }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    const all = await clientService.getAll();
    setClients(all);
  };

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleNew = () => {
    setEditing(EMPTY_CLIENT());
    setDeleteConfirm(null);
  };

  const handleEdit = (client: Client) => {
    setEditing({ ...client });
    setDeleteConfirm(null);
  };

  const handleFieldChange = (field: keyof Client, value: string) => {
    if (!editing) return;
    setEditing({ ...editing, [field]: value });
  };

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    await clientService.save(editing);
    await loadClients();
    setSaving(false);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    await clientService.delete(id);
    await loadClients();
    setDeleteConfirm(null);
    if (editing?.id === id) setEditing(null);
  };

  const inputClass = "w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg p-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Building2 size={22} className="text-purple-400" />
            <h2 className="text-xl font-bold text-white">Clients & Contacts</h2>
            <span className="text-sm text-slate-500">({clients.length} contacts)</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNew}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              <Plus size={16} />
              New Client
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
                  placeholder="Search clients..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filtered.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleEdit(client)}
                  className={`w-full text-left p-2.5 rounded-lg transition ${
                    editing?.id === client.id
                      ? 'bg-purple-500/10 border border-purple-500/30'
                      : 'hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  <p className="text-xs font-semibold text-white truncate">{client.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{client.company || client.email || '—'}</p>
                  <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded border mt-1 ${STATUS_COLORS[client.status] || ''}`}>
                    {STATUS_LABELS[client.status] || client.status}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-slate-600 text-center py-4">No clients found</p>
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-y-auto p-6">
            {editing ? (
              <div className="max-w-xl mx-auto space-y-5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-lg">
                    👤
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Edit Client</h3>
                    <p className="text-xs text-slate-500">{editing.id}</p>
                  </div>
                </div>

                {/* Name + Company */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                      <User size={10} className="inline mr-1" />Name *
                    </label>
                    <input className={inputClass} value={editing.name} onChange={(e) => handleFieldChange('name', e.target.value)} placeholder="Full name" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                      <Building2 size={10} className="inline mr-1" />Company
                    </label>
                    <input className={inputClass} value={editing.company} onChange={(e) => handleFieldChange('company', e.target.value)} placeholder="Company name" />
                  </div>
                </div>

                {/* Email + Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                      <Mail size={10} className="inline mr-1" />Email
                    </label>
                    <input className={inputClass} type="email" value={editing.email} onChange={(e) => handleFieldChange('email', e.target.value)} placeholder="email@example.com" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                      <Phone size={10} className="inline mr-1" />Phone
                    </label>
                    <input className={inputClass} value={editing.phone} onChange={(e) => handleFieldChange('phone', e.target.value)} placeholder="+1 555-0000" />
                  </div>
                </div>

                {/* Position + Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                      <Briefcase size={10} className="inline mr-1" />Position
                    </label>
                    <input className={inputClass} value={editing.position} onChange={(e) => handleFieldChange('position', e.target.value)} placeholder="e.g. CEO, CTO" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Status</label>
                    <select className={inputClass} value={editing.status} onChange={(e) => handleFieldChange('status', e.target.value)}>
                      <option value="lead">Lead</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Notes</label>
                  <textarea
                    className={`${inputClass} resize-none`}
                    rows={5}
                    value={editing.notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    placeholder="Notes about this client, previous conversations, preferences..."
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-slate-700">
                  <button
                    onClick={() => setDeleteConfirm(editing.id)}
                    className="flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => setEditing(null)}
                    className="bg-slate-800 text-slate-400 border border-slate-700 hover:text-white px-6 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !editing.name.trim()}
                    className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition cursor-pointer"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Saving...' : 'Save to Supabase'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <Building2 size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Select or create a client</p>
                  <p className="text-sm">Click a contact from the list or press "New Client"</p>
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
                <h3 className="font-bold">Delete Client</h3>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                This will permanently remove this contact from Supabase.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteConfirm(null)} className="bg-slate-800 text-slate-400 px-4 py-2 rounded-lg text-sm transition cursor-pointer">Cancel</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};