import React, { useState, useEffect } from 'react';
import { prospectService, type Prospect } from '../services/prospect-service';
import { X, Search, Briefcase, Plus, Trash2, Loader2, Save, FileText, Building2, User, Mail, Phone, Globe, Edit2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface ProspectsCRMPanelProps {
  onClose: () => void;
}

const NUEVO_PROSPECTO = (): Prospect => ({
  id: `prosp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  company_name: '',
  contact_name: '',
  email: '',
  website: '',
  phone: '',
  industry: '',
  notes: '',
  pain_points: '',
  draft_proposal: '',
  status: 'esperando',
  feedback: '',
});

export const ProspectsCRMPanel: React.FC<ProspectsCRMPanelProps> = ({ onClose }) => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'esperando' | 'aceptado' | 'rechazado'>('todos');

  // Selected / Editing Prospect
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadProspects();
  }, []);

  const loadProspects = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await prospectService.getAll();
      setProspects(all);
    } catch (e) {
      setError('Error al cargar la base de prospectos de Supabase. Asegúrate de ejecutar la migración SQL.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProspect || !selectedProspect.company_name.trim()) {
      alert('El nombre de la empresa es obligatorio');
      return;
    }

    setSaving(true);
    try {
      await prospectService.save(selectedProspect);
      setIsEditing(false);
      await loadProspects();
      // Keep the updated prospect selected
      const updated = prospects.find(p => p.id === selectedProspect.id) || selectedProspect;
      setSelectedProspect({ ...updated });
    } catch (err) {
      alert('Error al guardar el prospecto.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este prospecto de seguimiento?')) return;
    try {
      await prospectService.delete(id);
      setSelectedProspect(null);
      await loadProspects();
    } catch (e) {
      alert('Error al eliminar');
    }
  };

  const filteredProspects = prospects.filter((p) => {
    const matchesSearch =
      p.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.industry.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: Prospect['status']) => {
    switch (status) {
      case 'esperando':
        return <AlertCircle size={14} className="text-amber-500" />;
      case 'aceptado':
        return <CheckCircle size={14} className="text-green-500" />;
      case 'rechazado':
        return <XCircle size={14} className="text-red-500" />;
    }
  };

  const getStatusBadgeClass = (status: Prospect['status']) => {
    switch (status) {
      case 'esperando':
        return 'bg-amber-550/10 text-amber-400 border border-amber-500/20';
      case 'aceptado':
        return 'bg-green-550/10 text-green-400 border border-green-500/20';
      case 'rechazado':
        return 'bg-red-550/10 text-red-400 border border-red-500/20';
    }
  };

  const inputClass = "w-full bg-[#111622] border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500";
  const labelClass = "text-[10px] font-semibold text-gray-400 uppercase tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0B0F17] border border-gray-800 rounded-2xl shadow-2xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center">
              <Briefcase size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Seguimiento de Clientes & CRM</h2>
              <p className="text-xs text-gray-500">Administra tus prospectos de software y registra el feedback/estado comercial</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-all text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: List & Filters */}
          <div className="w-2/5 border-r border-gray-800 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 bg-[#0E131F] border-b border-gray-800 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar por empresa, contacto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#070A0F] border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Status Filters */}
              <div className="flex justify-between items-center">
                <div className="flex gap-1.5">
                  {(['todos', 'esperando', 'aceptado', 'rechazado'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2 py-1 text-[10px] font-bold rounded-md uppercase border transition-all ${
                        statusFilter === st
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'bg-[#070A0F] border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setSelectedProspect(NUEVO_PROSPECTO());
                    setIsEditing(true);
                  }}
                  className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded-md text-[10px] font-bold transition-all uppercase"
                >
                  <Plus size={12} />
                  Añadir
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 size={24} className="animate-spin text-red-500" />
                </div>
              ) : error ? (
                <div className="p-4 bg-red-900/10 border border-red-500/20 text-red-400 rounded-xl text-xs space-y-2">
                  <p className="font-semibold">Error:</p>
                  <p>{error}</p>
                </div>
              ) : filteredProspects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500 text-center">
                  <Briefcase size={36} className="text-gray-800 mb-2" />
                  <p className="text-xs">No se encontraron prospectos</p>
                </div>
              ) : (
                filteredProspects.map((p) => {
                  const isSelected = selectedProspect?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedProspect({ ...p });
                        setIsEditing(false);
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-[#111622]/50 border-gray-800/80 hover:border-gray-700/80'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-xs truncate max-w-[70%]">{p.company_name}</h4>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 ${getStatusBadgeClass(p.status)}`}>
                          {getStatusIcon(p.status)}
                          {p.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 truncate">
                        {p.contact_name || 'Sin contacto'} · {p.industry || 'Industria n/d'}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: Editor / View details */}
          <div className="w-3/5 bg-[#090C12] p-6 overflow-y-auto">
            {selectedProspect ? (
              isEditing ? (
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
                    <h3 className="text-base font-bold flex items-center gap-1.5">
                      <Edit2 size={16} className="text-red-400" />
                      Editar Información del Prospecto
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedProspect.company_name) setSelectedProspect(null);
                        setIsEditing(false);
                      }}
                      className="text-xs text-gray-500 hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2">
                      <label className={labelClass}>Nombre de la Empresa</label>
                      <input
                        type="text"
                        value={selectedProspect.company_name}
                        onChange={(e) => setSelectedProspect({ ...selectedProspect, company_name: e.target.value })}
                        placeholder="Ej. Gimnasio Fit"
                        className={inputClass}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={labelClass}>Persona de Contacto</label>
                      <input
                        type="text"
                        value={selectedProspect.contact_name}
                        onChange={(e) => setSelectedProspect({ ...selectedProspect, contact_name: e.target.value })}
                        placeholder="Ej. Juan Pérez"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={labelClass}>Email</label>
                      <input
                        type="email"
                        value={selectedProspect.email}
                        onChange={(e) => setSelectedProspect({ ...selectedProspect, email: e.target.value })}
                        placeholder="Ej. contacto@empresa.com"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={labelClass}>Teléfono</label>
                      <input
                        type="text"
                        value={selectedProspect.phone}
                        onChange={(e) => setSelectedProspect({ ...selectedProspect, phone: e.target.value })}
                        placeholder="Ej. +34600111222"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={labelClass}>Sitio Web</label>
                      <input
                        type="text"
                        value={selectedProspect.website}
                        onChange={(e) => setSelectedProspect({ ...selectedProspect, website: e.target.value })}
                        placeholder="Ej. http://empresa.com"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={labelClass}>Industria / Nicho</label>
                      <input
                        type="text"
                        value={selectedProspect.industry}
                        onChange={(e) => setSelectedProspect({ ...selectedProspect, industry: e.target.value })}
                        placeholder="Ej. Fitness"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={labelClass}>Estado de Seguimiento</label>
                      <select
                        value={selectedProspect.status}
                        onChange={(e) => setSelectedProspect({ ...selectedProspect, status: e.target.value as any })}
                        className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-red-500"
                      >
                        <option value="esperando">Esperando respuesta</option>
                        <option value="aceptado">Aceptado (Proyecto ganado)</option>
                        <option value="rechazado">Rechazado</option>
                      </select>
                    </div>

                    <div className="space-y-1 col-span-2">
                      <label className={labelClass}>Puntos de Dolor Identificados</label>
                      <textarea
                        value={selectedProspect.pain_points}
                        onChange={(e) => setSelectedProspect({ ...selectedProspect, pain_points: e.target.value })}
                        placeholder="Puntos débiles de su web, procesos..."
                        rows={3}
                        className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500 resize-none"
                      />
                    </div>

                    <div className="space-y-1 col-span-2">
                      <label className={labelClass}>Propuesta / Pitch Inicial</label>
                      <textarea
                        value={selectedProspect.draft_proposal}
                        onChange={(e) => setSelectedProspect({ ...selectedProspect, draft_proposal: e.target.value })}
                        placeholder="Mensaje de venta fría personalizado..."
                        rows={4}
                        className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500 resize-none font-sans"
                      />
                    </div>

                    <div className="space-y-1 col-span-2">
                      <label className={labelClass}>Observaciones / Feedback Comercial</label>
                      <textarea
                        value={selectedProspect.feedback}
                        onChange={(e) => setSelectedProspect({ ...selectedProspect, feedback: e.target.value })}
                        placeholder="Registra por qué rechazaron, qué pidieron ajustar, o qué comentarios dieron..."
                        rows={3}
                        className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500 resize-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs disabled:opacity-50 mt-4"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        Guardar Prospecto
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="space-y-6">
                  {/* Summary Header */}
                  <div className="flex justify-between items-start border-b border-gray-800 pb-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-gray-100">{selectedProspect.company_name}</h3>
                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 ${getStatusBadgeClass(selectedProspect.status)}`}>
                          {getStatusIcon(selectedProspect.status)}
                          {selectedProspect.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                        {selectedProspect.contact_name && <span className="flex items-center gap-1"><User size={12} /> {selectedProspect.contact_name}</span>}
                        {selectedProspect.phone && <span className="flex items-center gap-1"><Phone size={12} /> {selectedProspect.phone}</span>}
                        {selectedProspect.email && <span className="flex items-center gap-1"><Mail size={12} /> {selectedProspect.email}</span>}
                        {selectedProspect.website && (
                          <a
                            href={selectedProspect.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-red-400 hover:underline"
                          >
                            <Globe size={12} />
                            Sitio Web
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1 bg-[#1A1F2E] border border-gray-800 text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      >
                        <Edit2 size={12} />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(selectedProspect.id)}
                        className="p-1.5 bg-red-950/20 text-red-400 border border-red-900/30 hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Eliminar Prospecto"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Pain Points */}
                  {selectedProspect.pain_points && (
                    <div className="bg-[#111622]/40 border border-gray-850 p-4 rounded-xl space-y-2">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Puntos de Dolor
                      </h4>
                      <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {selectedProspect.pain_points}
                      </p>
                    </div>
                  )}

                  {/* Proposal */}
                  {selectedProspect.draft_proposal && (
                    <div className="bg-[#111622]/40 border border-gray-850 p-4 rounded-xl space-y-2">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Borrador de Propuesta Comercial
                      </h4>
                      <pre className="text-xs font-sans text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {selectedProspect.draft_proposal}
                      </pre>
                    </div>
                  )}

                  {/* Feedback / Observaciones */}
                  <div className="bg-red-600/5 border border-red-500/10 p-4 rounded-xl space-y-2">
                    <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                      Observaciones / Feedback Comercial
                    </h4>
                    {selectedProspect.feedback ? (
                      <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {selectedProspect.feedback}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 italic">Sin observaciones registradas. Haz clic en Editar para añadir notas.</p>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="h-full flex flex-col justify-center items-center text-center p-6 text-gray-500 space-y-4">
                <Briefcase size={48} className="text-gray-800" />
                <div className="max-w-xs space-y-1">
                  <h4 className="font-bold text-gray-400">Panel de Seguimiento</h4>
                  <p className="text-xs">Selecciona un prospecto a la izquierda para visualizar su información, propuesta, estado comercial y feedback.</p>
                  <p className="text-xs text-red-500/60 mt-2 font-medium">Los prospectos registrados aquí no volverán a aparecer en las nuevas prospecciones comerciales de la IA.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
