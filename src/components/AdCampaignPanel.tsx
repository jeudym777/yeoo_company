import React, { useState, useEffect } from 'react';
import { campaignService, type CampanaPublicitaria } from '../services/campaign-service';
import { agentService } from '../services/agent-service';
import { generateWithProvider } from '../services/provider-router';
import { FreepikService } from '../services/freepik-service';
import type { Agent, Provider } from '../types';
import { X, Search, Plus, Trash2, Loader2, Save, Sparkles, Megaphone, Palette, Edit2, FileText, Image as ImageIcon, Copy, Download, Layers } from 'lucide-react';

interface AdCampaignPanelProps {
  provider: Provider;
  model: string;
  onClose: () => void;
}

const NUEVA_CAMPANA = (): CampanaPublicitaria => ({
  id: `camp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: '',
  agent_id: '',
  context_extra: '',
  ad_copy: '',
  image_prompt: '',
  image_style: 'photo',
  images_json: []
});

const ESTILOS_FREEPIK = [
  { key: 'photo', label: 'Fotografía Realista' },
  { key: 'illustration', label: 'Ilustración' },
  { key: 'digital-art', label: 'Arte Digital' },
  { key: '3d', label: 'Render 3D' },
  { key: 'vintage', label: 'Vintage / Retro' },
  { key: 'pixel-art', label: 'Pixel Art' },
  { key: 'vector', label: 'Diseño Vectorial' }
];

export const AdCampaignPanel: React.FC<AdCampaignPanelProps> = ({
  provider,
  model,
  onClose
}) => {
  const [campaigns, setCampaigns] = useState<CampanaPublicitaria[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Campaign & Quantity selector
  const [selectedCampaign, setSelectedCampaign] = useState<CampanaPublicitaria | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [imageQuantity, setImageQuantity] = useState<number>(1);
  const [imageEngine, setImageEngine] = useState<'flux' | 'freepik'>('flux');
  const [activeTab, setActiveTab] = useState<'creative' | 'assets'>('creative');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const cList = await campaignService.getCampaigns();
      setCampaigns(cList);

      const aList = await agentService.getAllAgents();
      setAgents(aList);
    } catch (e) {
      setError('Error de conexión. Ejecuta la migración SQL para campana_publicitaria.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign || !selectedCampaign.name.trim() || !selectedCampaign.agent_id) return;

    setSaving(true);
    try {
      await campaignService.saveCampaign(selectedCampaign);
      setIsEditing(false);
      await loadAllData();
      // Keep selected
      const updated = campaigns.find(c => c.id === selectedCampaign.id) || selectedCampaign;
      setSelectedCampaign({ ...updated });
    } catch (err) {
      alert('Error al guardar la campaña.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta campaña publicitaria de forma permanente?')) return;
    try {
      await campaignService.deleteCampaign(id);
      setSelectedCampaign(null);
      await loadAllData();
    } catch (e) {
      alert('Error al eliminar campaña.');
    }
  };

  // Generate copywriting & Prompt visual
  const handleGenerateCopyAI = async () => {
    if (!selectedCampaign || !selectedCampaign.agent_id || !selectedCampaign.context_extra.trim()) {
      alert('Especifica un agente y escribe las directrices de campaña.');
      return;
    }

    setGeneratingCopy(true);
    try {
      const agent = agents.find(a => a.id === selectedCampaign.agent_id);
      const agentRole = agent ? `${agent.name} (${agent.division})` : 'Especialista en Marketing';

      const prompt = `You are YEOO OS AI Agent: ${agentRole}. 
Create a compelling marketing campaign in Spanish based on the following instructions:
"${selectedCampaign.context_extra}"

Tasks:
1. Write a high-converting copywriting for social media (Instagram, Facebook or LinkedIn). Include a catchy hook, main body highlighting benefits, a call to action (CTA), and relevant hashtags.
2. Formulate a highly detailed visual image generation prompt (in English) suitable for Freepik AI Text-to-Image generator. Focus on commercial aesthetics, lighting, clean backgrounds, and professional setup. Avoid text or letters in the image prompt, focus only on the visual concept.

You MUST respond ONLY with a valid JSON object matching the following structure:
{
  "ad_copy": "Copywriting text with emojis/markdown headers...",
  "image_prompt": "Visual prompt in English for the image generator..."
}
Do NOT include markdown code ticks (\`\`\`json) and no conversational text. Return only the raw JSON.`;

      const response = await generateWithProvider(provider, {
        model,
        prompt,
        temperature: 0.8
      });

      let jsonStr = response.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
      }

      const generated = JSON.parse(jsonStr);

      setSelectedCampaign(prev => {
        if (!prev) return null;
        return {
          ...prev,
          ad_copy: generated.ad_copy || '',
          image_prompt: generated.image_prompt || ''
        };
      });
      alert('Textos publicitarios y prompt visual estructurados por el agente. Revisa y pulsa Guardar.');
    } catch (err) {
      console.error(err);
      alert('Error al estructurar textos con el agente. Intenta rellenar manualmente.');
    } finally {
      setGeneratingCopy(false);
    }
  };

  // Generate image using Freepik or Pollinations Flux
  const handleGenerateImages = async () => {
    if (!selectedCampaign || !selectedCampaign.image_prompt.trim()) {
      alert('Debes tener un prompt visual listo.');
      return;
    }

    setGeneratingImages(true);
    try {
      let base64List: string[];
      if (imageEngine === 'flux') {
        base64List = await FreepikService.generateImagesPollinations(
          selectedCampaign.image_prompt.trim(),
          imageQuantity
        );
      } else {
        base64List = await FreepikService.generateImages(
          selectedCampaign.image_prompt.trim(),
          selectedCampaign.image_style,
          imageQuantity
        );
      }

      // Append new generated images to existing ones in the campaign
      const updatedImages = [...selectedCampaign.images_json, ...base64List];

      const updatedCampaign = {
        ...selectedCampaign,
        images_json: updatedImages
      };

      // Save to Supabase automatically
      await campaignService.saveCampaign(updatedCampaign);
      setSelectedCampaign(updatedCampaign);
      await loadAllData();
      setActiveTab('assets'); // Switch to view generated images
      alert(`¡Generación exitosa! Se han añadido ${base64List.length} imágenes a la campaña.`);
    } catch (err: any) {
      console.error(err);
      alert(`Error en la generación de imágenes: ${err.message || err}. Revisa tu conexión o créditos.`);
    } finally {
      setGeneratingImages(false);
    }
  };

  // Download base64 image as file
  const downloadImage = (base64Data: string, index: number) => {
    if (!selectedCampaign) return;
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${base64Data}`;
    link.download = `yeoo-campana-${selectedCampaign.name.toLowerCase().replace(/\s+/g, '-')}-${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete specific image from campaign list
  const handleDeleteImage = async (indexToDelete: number) => {
    if (!selectedCampaign || !confirm('¿Estás seguro de eliminar esta pieza gráfica de la campaña?')) return;
    const updatedImages = selectedCampaign.images_json.filter((_, idx) => idx !== indexToDelete);
    const updatedCampaign = { ...selectedCampaign, images_json: updatedImages };
    
    setSaving(true);
    try {
      await campaignService.saveCampaign(updatedCampaign);
      setSelectedCampaign(updatedCampaign);
      await loadAllData();
    } catch (e) {
      alert('Error al eliminar pieza gráfica');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copy publicitario copiado al portapapeles.');
  };

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.context_extra.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputClass = "w-full bg-[#111622] border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500";
  const labelClass = "text-[10px] font-semibold text-gray-400 uppercase tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0B0F17] border border-gray-800 rounded-2xl shadow-2xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center">
              <Megaphone size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Campañas Publicitarias</h2>
              <p className="text-xs text-gray-500">Diseña copys comerciales con tus agentes y genera imágenes publicitarias a través de Freepik AI</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-all text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Body Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: List */}
          <div className="w-1/3 border-r border-gray-800 flex flex-col overflow-hidden">
            <div className="p-4 bg-[#0E131F] border-b border-gray-800 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar campañas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#070A0F] border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <button
                onClick={() => {
                  setSelectedCampaign(NUEVA_CAMPANA());
                  setIsEditing(true);
                  setActiveTab('creative');
                }}
                className="w-full flex items-center justify-center gap-1 bg-red-600 hover:bg-red-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all uppercase"
              >
                <Plus size={12} />
                Nueva Campaña
              </button>
            </div>

            {/* Campaign lists */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 size={24} className="animate-spin text-red-500" />
                </div>
              ) : error ? (
                <div className="p-4 bg-red-950/20 border border-red-900/30 text-red-400 rounded-xl text-xs">
                  {error}
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500 text-center">
                  <Megaphone size={36} className="text-gray-800 mb-2" />
                  <p className="text-xs">No hay campañas publicitarias.</p>
                </div>
              ) : (
                filteredCampaigns.map((c) => {
                  const isSelected = selectedCampaign?.id === c.id;
                  const agentName = agents.find(a => a.id === c.agent_id)?.name || 'Agente';
                  return (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCampaign({ ...c }); setIsEditing(false); setActiveTab('creative'); }}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-[#111622]/50 border-gray-800/80 hover:border-gray-700/80'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-xs truncate max-w-[70%]">{c.name}</h4>
                        <span className="text-[8px] bg-red-600/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-semibold uppercase flex items-center gap-0.5">
                          <Layers size={8} /> {c.images_json.length} piezas
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 truncate">
                        Dirigida por: {agentName}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: Editor */}
          <div className="w-2/3 bg-[#090C12] flex flex-col overflow-hidden">
            {selectedCampaign ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tabs */}
                <div className="px-6 border-b border-gray-850 bg-[#0E131F]/50 flex justify-between items-center">
                  <div className="flex gap-4">
                    {(['creative', 'assets'] as const).map((tabId) => (
                      <button
                        key={tabId}
                        onClick={() => setActiveTab(tabId)}
                        className={`py-3 text-xs font-semibold border-b-2 transition-all capitalize ${
                          activeTab === tabId
                            ? 'border-red-500 text-white'
                            : 'border-transparent text-gray-400 hover:text-white'
                        }`}
                      >
                        {tabId === 'creative' ? 'Diseño de Campaña' : 'Galería de Imágenes'}
                      </button>
                    ))}
                  </div>

                  {!isEditing && activeTab === 'creative' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded bg-[#1A1F2E] border border-gray-800 text-gray-300 hover:text-white transition-all font-semibold uppercase"
                      >
                        <Edit2 size={10} />
                        Editar Config.
                      </button>
                      <button
                        onClick={() => handleDeleteCampaign(selectedCampaign.id)}
                        className="p-1.5 text-red-500 hover:bg-red-955/20 border border-transparent hover:border-red-900/30 rounded-lg transition-colors"
                        title="Eliminar Campaña"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {activeTab === 'creative' && (
                    isEditing ? (
                      <form onSubmit={handleSaveCampaign} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 col-span-2">
                            <label className={labelClass}>Nombre de la Campaña</label>
                            <input
                              type="text"
                              value={selectedCampaign.name}
                              onChange={(e) => setSelectedCampaign({ ...selectedCampaign, name: e.target.value })}
                              placeholder="Ej: Promo Julio Gimnasios"
                              className={inputClass}
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className={labelClass}>Agente Creativo Directivo</label>
                            <select
                              value={selectedCampaign.agent_id}
                              onChange={(e) => setSelectedCampaign({ ...selectedCampaign, agent_id: e.target.value })}
                              className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none"
                              required
                            >
                              <option value="">-- Seleccionar Agente --</option>
                              {agents.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.division})</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className={labelClass}>Estilo de Imagen Freepik</label>
                            <select
                              value={selectedCampaign.image_style}
                              onChange={(e) => setSelectedCampaign({ ...selectedCampaign, image_style: e.target.value })}
                              className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none"
                            >
                              {ESTILOS_FREEPIK.map(es => (
                                <option key={es.key} value={es.key}>{es.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1 col-span-2">
                            <label className={labelClass}>Directrices / Contexto de Venta</label>
                            <textarea
                              value={selectedCampaign.context_extra}
                              onChange={(e) => setSelectedCampaign({ ...selectedCampaign, context_extra: e.target.value })}
                              placeholder="Escribe la promoción, dolores del nicho a atacar, red social en la que publicarás, etc..."
                              rows={3}
                              className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none resize-none"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={saving}
                          className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs disabled:opacity-50 mt-4"
                        >
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Guardar Configuración
                        </button>
                      </form>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex justify-between items-start border-b border-gray-850 pb-4">
                          <div>
                            <h3 className="text-2xl font-bold text-white mb-2">{selectedCampaign.name}</h3>
                            <p className="text-xs text-gray-400">
                              Dirigida por el Agente: <span className="font-semibold text-red-400">{agents.find(a => a.id === selectedCampaign.agent_id)?.name || 'Especialista'}</span>
                            </p>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={handleGenerateCopyAI}
                              disabled={generatingCopy}
                              className="flex items-center gap-1.5 bg-[#1A1F2E] border border-gray-850 hover:bg-[#2D3548] text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                            >
                              {generatingCopy ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  Redactando...
                                </>
                              ) : (
                                <>
                                  <Sparkles size={12} className="text-red-400" />
                                  Estructurar Copy con IA
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Split layouts: Copywriting and Image generator */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* Copywriting */}
                          <div className="bg-[#111622]/40 border border-gray-850 p-4 rounded-xl space-y-3">
                            <div className="flex justify-between items-center border-b border-gray-800 pb-1.5">
                              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <FileText size={12} /> Copy Publicitario
                              </h4>
                              {selectedCampaign.ad_copy && (
                                <button
                                  onClick={() => copyToClipboard(selectedCampaign.ad_copy)}
                                  className="text-gray-500 hover:text-white transition-colors"
                                  title="Copiar Copy"
                                >
                                  <Copy size={12} />
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed min-h-[25vh]">
                              {selectedCampaign.ad_copy || 'Presiona el botón de arriba "Estructurar Copy con IA" para que el agente redacte los textos comerciales de la campaña.'}
                            </p>
                          </div>

                          {/* Image Prompt Generation & Trigger */}
                          <div className="bg-[#111622]/40 border border-gray-850 p-4 rounded-xl space-y-4">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 border-b border-gray-800 pb-1.5">
                              <Palette size={12} /> Generar Imagen Publicitaria
                            </h4>

                            {/* Generator Engine Selector */}
                            <div className="space-y-1">
                              <label className="text-[9px] text-gray-500 uppercase font-semibold">Motor de Generación</label>
                              <select
                                value={imageEngine}
                                onChange={(e) => setImageEngine(e.target.value as any)}
                                className="w-full bg-[#070A0F] border border-gray-800 rounded-lg p-1.5 text-[10px] text-white focus:outline-none"
                              >
                                <option value="flux">Flux (Gratuito y Libre)</option>
                                <option value="freepik">Freepik (Pago - Requiere Clave .env)</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] text-gray-500 uppercase font-semibold">Prompt Visual (Inglés)</label>
                              <textarea
                                value={selectedCampaign.image_prompt}
                                onChange={(e) => setSelectedCampaign({ ...selectedCampaign, image_prompt: e.target.value })}
                                placeholder="Escribe el prompt visual o dejaselo estructurar al agente..."
                                rows={3}
                                className="w-full bg-[#070A0F] border border-gray-800 rounded-lg p-2 text-[10px] text-gray-300 focus:outline-none resize-none leading-relaxed"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              {/* Quantity Selector */}
                              <div className="space-y-1">
                                <label className="text-[9px] text-gray-500 uppercase font-semibold">Piezas a Generar</label>
                                <select
                                  value={imageQuantity}
                                  onChange={(e) => setImageQuantity(parseInt(e.target.value))}
                                  className="w-full bg-[#070A0F] border border-gray-800 rounded-lg p-1.5 text-[10px] text-white focus:outline-none"
                                >
                                  <option value={1}>1 Imagen</option>
                                  <option value={2}>2 Imágenes</option>
                                  <option value={3}>3 Imágenes</option>
                                  <option value={4}>4 Imágenes (Límite)</option>
                                </select>
                              </div>

                              {/* Style (only enabled if freepik is selected) */}
                              <div className="space-y-1">
                                <label className="text-[9px] text-gray-500 uppercase font-semibold">Estilo (Freepik)</label>
                                <select
                                  value={selectedCampaign.image_style}
                                  onChange={(e) => setSelectedCampaign({ ...selectedCampaign, image_style: e.target.value })}
                                  disabled={imageEngine === 'flux'}
                                  className="w-full bg-[#070A0F] border border-gray-800 rounded-lg p-1.5 text-[10px] text-white focus:outline-none disabled:opacity-40"
                                >
                                  {ESTILOS_FREEPIK.map(es => (
                                    <option key={es.key} value={es.key}>{es.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <button
                              onClick={handleGenerateImages}
                              disabled={generatingImages || !selectedCampaign.image_prompt.trim()}
                              className="w-full bg-gradient-to-r from-green-600 to-green-800 hover:from-green-500 hover:to-green-700 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs disabled:opacity-50 cursor-pointer shadow-md shadow-green-950/20"
                            >
                              {generatingImages ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  Generando con {imageEngine === 'flux' ? 'Flux' : 'Freepik'}...
                                </>
                              ) : (
                                <>
                                  <ImageIcon size={14} />
                                  Generar Pieza Gráfica
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  {activeTab === 'assets' && (
                    <div className="space-y-4">
                      <div className="border-b border-gray-850 pb-2">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <ImageIcon size={14} className="text-red-400" />
                          Piezas Gráficas Generadas ({selectedCampaign.images_json.length})
                        </h3>
                      </div>

                      {selectedCampaign.images_json.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500 text-center space-y-2">
                          <ImageIcon size={36} className="text-gray-800" />
                          <p className="text-xs">No hay imágenes generadas para esta campaña.</p>
                          <p className="text-[10px] text-gray-600 max-w-xs">Escribe un prompt en el diseño de campaña y haz clic en Generar Pieza Gráfica.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          {selectedCampaign.images_json.map((base64, idx) => (
                            <div key={idx} className="bg-[#111622]/40 border border-gray-850 rounded-xl overflow-hidden group relative flex flex-col">
                              {/* Display Image */}
                              <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                                <img
                                  src={`data:image/jpeg;base64,${base64}`}
                                  alt={`Pieza publicitaria ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-350"
                                />
                                
                                {/* Hover overlay action buttons */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                                  <button
                                    onClick={() => downloadImage(base64, idx)}
                                    className="p-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center gap-1 text-xs font-semibold transition-all shadow"
                                    title="Descargar Imagen"
                                  >
                                    <Download size={14} />
                                    Descargar
                                  </button>
                                  <button
                                    onClick={() => handleDeleteImage(idx)}
                                    className="p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all shadow"
                                    title="Eliminar de la campaña"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="p-2.5 border-t border-gray-850 flex justify-between items-center">
                                <span className="text-[10px] text-gray-400 font-semibold">Pieza Gráfica #{idx + 1}</span>
                                <button
                                  onClick={() => downloadImage(base64, idx)}
                                  className="text-gray-500 hover:text-white transition-colors"
                                  title="Descargar"
                                >
                                  <Download size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col justify-center items-center text-center p-6 text-gray-500 space-y-4">
                <Megaphone size={48} className="text-gray-800" />
                <div className="max-w-xs space-y-1">
                  <h4 className="font-bold text-gray-400">Marketing de Campañas</h4>
                  <p className="text-xs">Selecciona o crea una campaña publicitaria de la lista izquierda para estructurar textos comerciales y generar piezas gráficas descargables.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default AdCampaignPanel;
