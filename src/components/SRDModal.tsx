import React, { useState } from 'react';
import type { Agent } from '../types';
import { srdGenerator } from '../services/srd-generator';
import { googleDriveService } from '../services/google-drive';
import { FileText, Download, Cloud, Loader2, CheckCircle, XCircle, CheckSquare, Square, SlidersHorizontal } from 'lucide-react';

interface SRDModalProps {
  projectName: string;
  agents: Agent[];
  messages: { role: string; content: string; agentName?: string; timestamp: string }[];
  onClose: () => void;
}

export interface SrdOptions {
  includeFunctional: boolean;
  includeNonFunctional: boolean;
  includeRisks: boolean;
  includeTimeEstimate: boolean;
  includeAgentAnalysis: boolean;
  includeConclusion: boolean;
  maxReqsPerAgent: number;
  maxAnalysisChars: number;
}

const SECTION_CONFIG = [
  { key: 'includeFunctional' as const, label: '1. Requerimientos Funcionales' },
  { key: 'includeNonFunctional' as const, label: '2. Requerimientos No Funcionales' },
  { key: 'includeRisks' as const, label: '3. Análisis de Riesgos' },
  { key: 'includeTimeEstimate' as const, label: '4. Estimación de Tiempo' },
  { key: 'includeAgentAnalysis' as const, label: '5. Análisis por Agente' },
  { key: 'includeConclusion' as const, label: '6. Conclusión' },
];

const DEFAULT_OPTIONS: SrdOptions = {
  includeFunctional: true,
  includeNonFunctional: true,
  includeRisks: true,
  includeTimeEstimate: true,
  includeAgentAnalysis: true,
  includeConclusion: true,
  maxReqsPerAgent: 8,
  maxAnalysisChars: 2000,
};

export const SRDModal: React.FC<SRDModalProps> = ({ projectName, agents, messages, onClose }) => {
  const [status, setStatus] = useState<'config' | 'generating' | 'done' | 'error'>('config');
  const [options, setOptions] = useState<SrdOptions>(DEFAULT_OPTIONS);
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const handleGenerate = async () => {
    const anySelected = SECTION_CONFIG.some(({ key }) => options[key]);
    if (!anySelected) {
      setError('Selecciona al menos una secci\u00f3n para incluir en el documento.');
      setStatus('error');
      return;
    }
    setStatus('generating');
    setError(null);
    try {
      const blob = await srdGenerator.generateSrd({
        projectName,
        agents,
        messages,
        options,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SRD_${projectName.replace(/\s+/g, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error generating SRD');
      setStatus('error');
    }
  };

  const handleUploadToDrive = async () => {
    const anySelected = SECTION_CONFIG.some(({ key }) => options[key]);
    if (!anySelected) {
      setError('Selecciona al menos una secci\u00f3n.');
      setStatus('error');
      return;
    }
    setStatus('generating');
    setError(null);
    try {
      const blob = await srdGenerator.generateSrd({
        projectName,
        agents,
        messages,
        options,
      });
      const link = await googleDriveService.uploadFile(
        `SRD_${projectName.replace(/\s+/g, '_')}.docx`,
        blob
      );
      setDriveLink(link);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error uploading to Google Drive');
      setStatus('error');
    }
  };

  const toggleOption = (key: keyof SrdOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const agentCount = agents.filter((a) => messages.some((m) => m.agentName === a.name)).length;
  const selectedSections = SECTION_CONFIG.filter(({ key }) => options[key]).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827] border border-[#2D3548] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-[#1F2937]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Software Requirements Doc</h3>
              <p className="text-sm text-gray-400">{projectName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2">
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="bg-[#0A0A0A] border border-[#1F2937] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Agents contributing</span>
              <span className="text-white font-bold">{agentCount} / {agents.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Messages analyzed</span>
              <span className="text-white font-bold">{messages.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Selected sections</span>
              <span className="text-white font-bold">{selectedSections}</span>
            </div>
          </div>

          {status === 'config' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <SlidersHorizontal size={16} className="text-purple-400" />
                <span>Select sections to include</span>
              </div>
              <div className="space-y-1.5">
                {SECTION_CONFIG.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => toggleOption(key)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      options[key]
                        ? 'bg-purple-500/10 border-purple-500/30 text-white'
                        : 'bg-[#1A1F2E] border-[#2D3548] text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {options[key] ? (
                      <CheckSquare size={18} className="text-purple-400 flex-shrink-0" />
                    ) : (
                      <Square size={18} className="text-gray-600 flex-shrink-0" />
                    )}
                    <span className="text-sm">{label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1F2937]">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Max reqs / agent</label>
                  <select
                    className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg p-2.5 text-white text-sm"
                    value={options.maxReqsPerAgent}
                    onChange={(e) => setOptions((p) => ({ ...p, maxReqsPerAgent: parseInt(e.target.value) }))}
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                    <option value={20}>20 (all)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Analysis detail</label>
                  <select
                    className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg p-2.5 text-white text-sm"
                    value={options.maxAnalysisChars}
                    onChange={(e) => setOptions((p) => ({ ...p, maxAnalysisChars: parseInt(e.target.value) }))}
                  >
                    <option value={500}>Brief (500 chars)</option>
                    <option value={1000}>Standard (1K)</option>
                    <option value={2000}>Detailed (2K)</option>
                    <option value={4000}>Full (4K)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleGenerate}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <Download size={18} />
                  Generate & Download .docx
                </button>
                <button
                  onClick={handleUploadToDrive}
                  className="w-full bg-[#1A1F2E] text-gray-400 border border-[#2D3548] hover:bg-[#2D3548] font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <Cloud size={18} />
                  Upload to Google Drive
                </button>
              </div>
            </div>
          )}

          {status === 'generating' && (
            <div className="flex items-center justify-center gap-3 py-6">
              <Loader2 size={24} className="animate-spin text-purple-400" />
              <span className="text-gray-400">Generating SRD document...</span>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#22C55E] bg-[#22C55E]/10 p-3 rounded-xl">
                <CheckCircle size={18} />
                <span className="text-sm">SRD generated successfully!</span>
              </div>
              {downloaded && <p className="text-xs text-gray-500">.docx file downloaded to your computer.</p>}
              {driveLink && (
                <a href={driveLink} target="_blank" rel="noopener noreferrer"
                  className="block w-full text-center bg-[#1A1F2E] text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 py-2.5 rounded-xl text-sm transition-all"
                >
                  📄 Open in Google Drive
                </a>
              )}
              <button onClick={() => { setStatus('config'); setDriveLink(null); setDownloaded(false); }}
                className="w-full bg-[#1A1F2E] text-gray-400 border border-[#2D3548] py-2 rounded-xl text-sm hover:bg-[#2D3548] transition-all"
              >
                Generate Again
              </button>
            </div>
          )}

          {status === 'error' && error && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-xl">
                <XCircle size={18} />
                <span className="text-sm">{error}</span>
              </div>
              <button onClick={() => setStatus('config')}
                className="w-full bg-[#1A1F2E] text-gray-400 border border-[#2D3548] py-2 rounded-xl text-sm hover:bg-[#2D3548] transition-all"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};