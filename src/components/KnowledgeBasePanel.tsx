import React, { useState, useEffect } from 'react';
import { ragService, type CompanyKnowledge } from '../services/rag-service';
import { X, BookOpen, Plus, Trash2, Loader2, Save, FileText, Tag, Database, Sparkles, Brain } from 'lucide-react';

interface KnowledgeBasePanelProps {
  onClose: () => void;
}

export const KnowledgeBasePanel: React.FC<KnowledgeBasePanelProps> = ({ onClose }) => {
  const [docs, setDocs] = useState<CompanyKnowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('servicios');

  const categories = [
    { key: 'servicios', label: 'Servicios & Oferta' },
    { key: 'tarifas', label: 'Tarifas & Precios' },
    { key: 'proyectos', label: 'Proyectos & Portafolio' },
    { key: 'metodologia', label: 'Metodología & Operaciones' },
    { key: 'general', label: 'Información General' }
  ];

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await ragService.getAll();
      setDocs(all);
    } catch (e) {
      setError('Error al cargar la base de conocimiento en Supabase. Asegúrate de ejecutar la migración SQL.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('El título y contenido son obligatorios');
      return;
    }

    setSaving(true);
    try {
      await ragService.add(title.trim(), content.trim(), category);
      setTitle('');
      setContent('');
      setShowAddForm(false);
      await loadDocs();
    } catch (err) {
      alert('Error al guardar y vectorizar el documento. Revisa tu clave de API de Gemini.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este documento de la base de conocimiento?')) return;
    try {
      await ragService.delete(id);
      await loadDocs();
    } catch (e) {
      alert('Error al eliminar');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0B0F17] border border-gray-800 rounded-2xl shadow-2xl w-[95vw] max-w-5xl h-[85vh] flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center">
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Cerebro RAG Corporativo</h2>
              <p className="text-xs text-gray-500">Base de conocimiento vectorizada en Supabase para tus agentes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-all text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: List */}
          <div className="w-1/2 border-r border-gray-800 flex flex-col overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Database size={14} className="text-red-400" />
                Documentos ({docs.length})
              </h3>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                >
                  <Plus size={14} />
                  Añadir Documento
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-red-500" />
              </div>
            ) : error ? (
              <div className="p-4 bg-red-900/10 border border-red-500/20 text-red-400 rounded-xl text-xs space-y-2">
                <p className="font-semibold">Error detectado:</p>
                <p>{error}</p>
                <p className="text-gray-500">Asegúrate de que la extensión <code>vector</code> y la tabla <code>company_knowledge</code> estén cargadas.</p>
              </div>
            ) : docs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20 border border-dashed border-gray-800 rounded-xl p-6">
                <BookOpen size={40} className="text-gray-600 mb-3" />
                <p className="font-semibold text-gray-400">Base de conocimiento vacía</p>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">Registra información sobre tu empresa para que los agentes sepan responder adecuadamente.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {docs.map((doc) => (
                  <div key={doc.id} className="bg-[#111622] border border-gray-800/80 hover:border-gray-700/80 p-4 rounded-xl space-y-2 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Tag size={12} className="text-red-400" />
                        <span className="text-[10px] bg-[#1C2333] text-red-400 px-2 py-0.5 rounded font-semibold uppercase">
                          {categories.find(c => c.key === doc.category)?.label || doc.category}
                        </span>
                      </div>
                      <button
                        onClick={() => doc.id && handleDelete(doc.id)}
                        className="text-gray-500 hover:text-red-400 p-1 rounded transition-colors"
                        title="Eliminar documento"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <h4 className="font-bold text-sm text-gray-100">{doc.title}</h4>
                    <p className="text-xs text-gray-400 whitespace-pre-line line-clamp-4">{doc.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel: Editor or info */}
          <div className="w-1/2 bg-[#090C12] p-6 overflow-y-auto">
            {showAddForm ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Sparkles size={18} className="text-red-400" />
                    Nuevo Documento Vectorial
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-xs text-gray-500 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Título del Documento</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej. Tarifas de Desarrollo Web Movil"
                    className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  >
                    {categories.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Contenido / Datos</label>
                  <p className="text-[10px] text-gray-500">Sé detallado. La IA utilizará este texto completo como referencia de hechos exactos.</p>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Ej: Cobramos $50 por hora para desarrollo senior de React. Los proyectos pequeños suelen estimarse entre 80-120 horas con entregas bisemanales..."
                    rows={8}
                    className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-950/20 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Vectorizando con Gemini...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Vectorizar & Guardar
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="h-full flex flex-col justify-center items-center text-center p-6 text-gray-500 space-y-4">
                <FileText size={48} className="text-gray-800" />
                <div className="max-w-xs space-y-1">
                  <h4 className="font-bold text-gray-400">¿Cómo funciona el RAG?</h4>
                  <p className="text-xs">Al registrar y vectorizar un documento, la información se convierte en un vector matemático.</p>
                  <p className="text-xs mt-2">Cuando un usuario chatea con los agentes, el sistema busca semánticamente en Supabase la información relevante y la inyecta automáticamente en sus prompts.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
