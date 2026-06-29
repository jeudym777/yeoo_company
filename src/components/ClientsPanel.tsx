import React, { useState, useEffect } from 'react';
import { clientService, type Client } from '../services/client-service';
import { Search, Building2, Mail, Phone, QrCode, Star, CalendarDays, Loader2, Plus, Save, Trash2, AlertCircle, RefreshCw } from 'lucide-react';

const NUEVO_CLIENTE = (): Client => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `cli-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  nombre: '',
  apellidos: '',
  email: '',
  telefono: '',
  tipo_identificacion: 'cedula',
  numero_identificacion: '',
  puntos_acumulados: 0,
  nivel_fidelidad: 'bronce',
  qr_code: `QR-${Date.now()}`,
  recibir_promociones: false,
  cumpleanos_dia: null,
  cumpleanos_mes: null,
  fecha_ultimo_punto: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const NIVELES = ['bronce', 'plata', 'oro', 'platino'];
const TIPOS_ID = ['cedula', 'pasaporte', 'licencia', 'otro'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface ClientsPanelProps {
  onClose: () => void;
}

export const ClientsPanel: React.FC<ClientsPanelProps> = ({ onClose }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await clientService.getAll();
      setClients(all);
      if (all.length === 0) setError('No hay clientes en Supabase. Crea el primero.');
    } catch (e) {
      setError('Error al cargar clientes. Revisa la consola.');
    }
    setLoading(false);
  };

  const filtered = clients.filter(
    (c) =>
      `${c.nombre} ${c.apellidos}`.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.numero_identificacion.includes(search)
  );

  const handleNew = () => { setEditing(NUEVO_CLIENTE()); setDeleteConfirm(null); };
  const handleEdit = (c: Client) => { setEditing({ ...c }); setDeleteConfirm(null); };

  const handleField = (field: keyof Client, value: any) => {
    if (!editing) return;
    setEditing({ ...editing, [field]: value });
  };

  const handleSave = async () => {
    if (!editing || !editing.nombre.trim() || !editing.apellidos.trim() || !editing.email.trim()) {
      alert('Nombre, apellidos y email son obligatorios');
      return;
    }
    setSaving(true);
    try {
      await clientService.save(editing);
      await loadClients();
      setEditing(null);
    } catch (e) {
      alert('Error al guardar');
    }
    setSaving(false);
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Building2 size={22} className="text-purple-400" />
            <h2 className="text-xl font-bold text-white">Clientes</h2>
            <span className="text-sm text-slate-500">({clients.length} registros)</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadClients} className="flex items-center gap-1 text-slate-400 hover:text-white text-xs cursor-pointer"><RefreshCw size={14} /> Recargar</button>
            <button onClick={handleNew} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer"><Plus size={16} /> Nuevo</button>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl cursor-pointer">✕</button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-80 border-r border-slate-700 flex flex-col">
            <div className="p-3 border-b border-slate-800">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-purple-400" /></div>
              ) : error && clients.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <p className="text-xs text-slate-500 mb-3">{error}</p>
                  <button onClick={loadClients} className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer">⟳ Reintentar</button>
                </div>
              ) : (
                filtered.map((client) => (
                  <button key={client.id} onClick={() => handleEdit(client)}
                    className={`w-full text-left p-2.5 rounded-lg transition ${editing?.id === client.id ? 'bg-purple-500/10 border border-purple-500/30' : 'hover:bg-slate-800 border border-transparent'}`}>
                    <p className="text-xs font-semibold text-white truncate">{client.nombre} {client.apellidos}</p>
                    <p className="text-[10px] text-slate-500 truncate">{client.email}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[9px] capitalize text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{client.nivel_fidelidad}</span>
                      <span className="text-[9px] text-purple-400">{client.puntos_acumulados} pts</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {editing ? (
              <div className="max-w-xl mx-auto space-y-5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  {editing.id.includes('cli-') ? '🆕 Nuevo Cliente' : '✏️ Editar Cliente'}
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Nombre *</label>
                    <input className={inputClass} value={editing.nombre} onChange={(e) => handleField('nombre', e.target.value)} placeholder="Nombre" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Apellidos *</label>
                    <input className={inputClass} value={editing.apellidos} onChange={(e) => handleField('apellidos', e.target.value)} placeholder="Apellidos" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Email *</label>
                    <input className={inputClass} type="email" value={editing.email} onChange={(e) => handleField('email', e.target.value)} placeholder="email@ejemplo.com" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Teléfono</label>
                    <input className={inputClass} value={editing.telefono} onChange={(e) => handleField('telefono', e.target.value)} placeholder="+506 8888-8888" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Tipo ID</label>
                    <select className={inputClass} value={editing.tipo_identificacion} onChange={(e) => handleField('tipo_identificacion', e.target.value)}>
                      {TIPOS_ID.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Número ID</label>
                    <input className={inputClass} value={editing.numero_identificacion} onChange={(e) => handleField('numero_identificacion', e.target.value)} placeholder="1-2345-6789" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Nivel</label>
                    <select className={inputClass} value={editing.nivel_fidelidad} onChange={(e) => handleField('nivel_fidelidad', e.target.value)}>
                      {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Puntos</label>
                    <input className={inputClass} type="number" min={0} value={editing.puntos_acumulados} onChange={(e) => handleField('puntos_acumulados', parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Promos</label>
                    <select className={inputClass} value={editing.recibir_promociones ? 'si' : 'no'} onChange={(e) => handleField('recibir_promociones', e.target.value === 'si')}>
                      <option value="si">✅ Sí</option>
                      <option value="no">❌ No</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Mes cumpleaños</label>
                    <select className={inputClass} value={editing.cumpleanos_mes || ''} onChange={(e) => handleField('cumpleanos_mes', e.target.value || null)}>
                      <option value="">—</option>
                      {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Día</label>
                    <input className={inputClass} type="number" min={1} max={31} value={editing.cumpleanos_dia || ''} onChange={(e) => handleField('cumpleanos_dia', e.target.value ? parseInt(e.target.value) : null)} />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-700">
                  <button onClick={() => setDeleteConfirm(editing.id)} className="flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer">
                    <Trash2 size={14} /> Eliminar
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => setEditing(null)} className="bg-slate-800 text-slate-400 border border-slate-700 hover:text-white px-6 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer">Cancelar</button>
                  <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition cursor-pointer">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <Building2 size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Selecciona o crea un cliente</p>
                  <p className="text-sm">Usa "Nuevo" para agregar o haz clic en un cliente de la lista</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {deleteConfirm && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-60">
            <div className="bg-slate-900 border border-red-500/30 rounded-xl p-6 max-w-sm shadow-2xl">
              <div className="flex items-center gap-2 text-red-400 mb-4"><AlertCircle size={20} /><h3 className="font-bold">Eliminar Cliente</h3></div>
              <p className="text-sm text-slate-400 mb-4">¿Eliminar permanentemente este cliente de Supabase?</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteConfirm(null)} className="bg-slate-800 text-slate-400 px-4 py-2 rounded-lg text-sm transition cursor-pointer">Cancelar</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer">Eliminar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};