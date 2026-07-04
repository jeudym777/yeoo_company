import React, { useState, useEffect } from 'react';
import { prospectingService, type Lead } from '../services/prospecting-service';
import { X, Search, Mail, Phone, Globe, Save, Trash2, Loader2, Copy, Check, Sparkles, Building2, Eye } from 'lucide-react';
import type { Provider } from '../types';

interface LeadProspectingPanelProps {
  provider: Provider;
  model: string;
  onClose: () => void;
}

export const LeadProspectingPanel: React.FC<LeadProspectingPanelProps> = ({
  provider,
  model,
  onClose,
}) => {
  const [tab, setTab] = useState<'search' | 'saved'>('search');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [savedLeads, setSavedLeads] = useState<Lead[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Selected Lead Details
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSavedLeads();
  }, []);

  const loadSavedLeads = async () => {
    setLoadingSaved(true);
    try {
      const all = await prospectingService.getSavedLeads();
      setSavedLeads(all);
      setSavedIds(new Set(all.map(l => l.company_name))); // Track using company name to prevent duplicates
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!industry.trim() || !location.trim()) {
      alert('Especifica la industria y la ubicación');
      return;
    }

    setIsSearching(true);
    setSelectedLead(null);
    setSearchResults([]);
    try {
      const results = await prospectingService.prospectLeads(
        industry.trim(),
        location.trim(),
        provider,
        model
      );
      setSearchResults(results);
      if (results.length > 0) setSelectedLead(results[0]);
    } catch (err) {
      alert('Error en la prospección. Intenta con otro modelo u otro proveedor.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveLead = async (lead: Lead) => {
    try {
      await prospectingService.saveLead(lead);
      setSavedIds(prev => new Set([...prev, lead.company_name]));
      alert('Prospecto guardado exitosamente en Supabase.');
      loadSavedLeads();
    } catch (e) {
      alert('Error al guardar prospecto.');
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este prospecto?')) return;
    try {
      await prospectingService.deleteLead(id);
      if (selectedLead?.id === id) setSelectedLead(null);
      loadSavedLeads();
    } catch (e) {
      alert('Error al eliminar');
    }
  };

  const handleStatusChange = async (id: string, status: Lead['status']) => {
    try {
      await prospectingService.updateLeadStatus(id, status);
      loadSavedLeads();
      if (selectedLead?.id === id) {
        setSelectedLead(prev => prev ? { ...prev, status } : null);
      }
    } catch (e) {
      alert('Error al actualizar estado');
    }
  };

  const handleCopyProposal = () => {
    if (!selectedLead?.draft_proposal) return;
    navigator.clipboard.writeText(selectedLead.draft_proposal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status: Lead['status']) => {
    switch (status) {
      case 'new': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'contacted': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'interested': return 'bg-green-500/10 text-green-400 border border-green-500/20';
      case 'replied': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'archived': return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0B0F17] border border-gray-800 rounded-2xl shadow-2xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center text-xl">
              🎯
            </div>
            <div>
              <h2 className="text-xl font-bold">Prospección Comercial (Lead Gen)</h2>
              <p className="text-xs text-gray-500">Encuentra clientes potenciales, audita sus problemas y escribe correos de venta en frío</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-[#111622] border border-gray-800 p-0.5 rounded-lg">
              <button
                onClick={() => { setTab('search'); setSelectedLead(null); }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  tab === 'search' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                🔎 Buscar Leads
              </button>
              <button
                onClick={() => { setTab('saved'); loadSavedLeads(); setSelectedLead(null); }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  tab === 'saved' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                📂 Leads Guardados ({savedLeads.length})
              </button>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-all text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Form & List */}
          <div className="w-2/5 border-r border-gray-800 flex flex-col overflow-hidden">
            {tab === 'search' ? (
              <form onSubmit={handleSearch} className="p-4 bg-[#0E131F] border-b border-gray-800 space-y-3">
                <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Configuración de Prospección</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400">Industria / Nicho</label>
                    <input
                      type="text"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="Ej. Gimnasios, Clinicas Dentales"
                      className="w-full bg-[#070A0F] border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
                      required
                      disabled={isSearching}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400">Región / Ubicación</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ej: Madrid, San Jose"
                      className="w-full bg-[#070A0F] border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
                      required
                      disabled={isSearching}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !industry.trim() || !location.trim()}
                  className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs disabled:opacity-50"
                >
                  {isSearching ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Procesando con {model}...
                    </>
                  ) : (
                    <>
                      <Search size={14} />
                      Prospectar Nuevos Clientes
                    </>
                  )}
                </button>
              </form>
            ) : null}

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {tab === 'search' ? (
                isSearching ? (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-3">
                    <Loader2 size={32} className="animate-spin text-red-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-300">Auditoría en curso</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-xs">El agente de mercadeo está buscando y diagnosticando negocios que necesiten desarrollo de software...</p>
                    </div>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-20 text-gray-500">
                    <Building2 size={36} className="text-gray-800 mb-2" />
                    <p className="text-xs">No hay resultados. Realiza una búsqueda de prospección arriba.</p>
                  </div>
                ) : (
                  searchResults.map((lead) => {
                    const isSelected = selectedLead?.company_name === lead.company_name;
                    const isSaved = savedIds.has(lead.company_name);
                    return (
                      <button
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-red-500/10 border-red-500/30'
                            : 'bg-[#111622]/50 border-gray-800/80 hover:border-gray-700/80'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-xs truncate max-w-[70%]">{lead.company_name}</h4>
                          {isSaved && (
                            <span className="text-[9px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20">
                              Guardado
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 truncate">{lead.contact_name} · {lead.phone}</p>
                      </button>
                    );
                  })
                )
              ) : (
                loadingSaved ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 size={24} className="animate-spin text-red-500" />
                  </div>
                ) : savedLeads.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-20 text-gray-500">
                    <Save size={36} className="text-gray-800 mb-2" />
                    <p className="text-xs">No tienes prospectos guardados en Supabase aún.</p>
                  </div>
                ) : (
                  savedLeads.map((lead) => {
                    const isSelected = selectedLead?.id === lead.id;
                    return (
                      <button
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-red-500/10 border-red-500/30'
                            : 'bg-[#111622]/50 border-gray-800/80 hover:border-gray-700/80'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-xs truncate max-w-[75%]">{lead.company_name}</h4>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${getStatusColor(lead.status)}`}>
                            {lead.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 truncate">{lead.contact_name} · {lead.phone}</p>
                      </button>
                    );
                  })
                )
              )}
            </div>
          </div>

          {/* Right Column: Lead Detailed Info & Proposal */}
          <div className="w-3/5 bg-[#090C12] p-6 overflow-y-auto flex flex-col">
            {selectedLead ? (
              <div className="space-y-6 flex-1 flex flex-col">
                {/* Lead Summary */}
                <div className="flex justify-between items-start border-b border-gray-800 pb-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Building2 className="text-red-400" size={20} />
                      {selectedLead.company_name}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Eye size={12} /> {selectedLead.contact_name || 'Gerente'}</span>
                      {selectedLead.phone && <span className="flex items-center gap-1"><Phone size={12} /> {selectedLead.phone}</span>}
                      {selectedLead.email && <span className="flex items-center gap-1"><Mail size={12} /> {selectedLead.email}</span>}
                      {selectedLead.website && (
                        <a
                          href={selectedLead.website}
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
                    {tab === 'search' ? (
                      <button
                        onClick={() => handleSaveLead(selectedLead)}
                        disabled={savedIds.has(selectedLead.company_name)}
                        className="flex items-center gap-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      >
                        <Save size={14} />
                        Guardar Prospecto
                      </button>
                    ) : (
                      <>
                        <select
                          value={selectedLead.status}
                          onChange={(e) => selectedLead.id && handleStatusChange(selectedLead.id, e.target.value as any)}
                          className="bg-[#111622] border border-gray-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                        >
                          <option value="new">Nuevo</option>
                          <option value="contacted">Contactado</option>
                          <option value="interested">Interesado</option>
                          <option value="replied">Respondió</option>
                          <option value="archived">Archivado</option>
                        </select>
                        <button
                          onClick={() => selectedLead.id && handleDeleteLead(selectedLead.id)}
                          className="p-1.5 bg-red-950/20 text-red-400 border border-red-900/30 hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Eliminar Lead"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Pain Points */}
                <div className="bg-[#111622]/40 border border-gray-850 p-4 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={12} className="text-red-400" />
                    Puntos de Dolor Identificados
                  </h4>
                  <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {selectedLead.pain_points}
                  </div>
                </div>

                {/* Pitch Email Draft */}
                <div className="flex-1 flex flex-col space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Mail size={12} className="text-red-400" />
                      Borrador de Correo de Venta (Pitch)
                    </h4>
                    <button
                      onClick={handleCopyProposal}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <div className="flex-1 bg-[#070A0F] border border-gray-850 p-4 rounded-xl overflow-y-auto max-h-[30vh]">
                    <pre className="text-xs font-sans text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {selectedLead.draft_proposal}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 py-20 space-y-3">
                <Building2 size={48} className="text-gray-800" />
                <div>
                  <h4 className="font-bold text-gray-400">Detalles del Prospecto</h4>
                  <p className="text-xs max-w-xs mt-1">Selecciona un cliente potencial del panel izquierdo para auditar sus problemas y ver su correo de venta personalizado.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
