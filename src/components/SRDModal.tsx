import React, { useState } from 'react';
import type { Agent, Provider } from '../types';
import { srdGenerator } from '../services/srd-generator';
import { googleDriveService } from '../services/google-drive';
import { generateWithProvider } from '../services/provider-router';
import { FileText, Download, Cloud, Loader2, CheckCircle, XCircle, CheckSquare, Square, SlidersHorizontal, Brain, MessageSquare } from 'lucide-react';

interface SRDModalProps {
  projectName: string;
  agents: Agent[];
  messages: { role: string; content: string; agentName?: string; timestamp: string }[];
  provider: Provider;
  model: string;
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

export const SRDModal: React.FC<SRDModalProps> = ({ projectName, agents, messages, provider, model, onClose }) => {
  const [status, setStatus] = useState<'config' | 'analyzing' | 'generating' | 'done' | 'error'>('config');
  const [options, setOptions] = useState<SrdOptions>(DEFAULT_OPTIONS);
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [enrichedMessages, setEnrichedMessages] = useState<typeof messages>([]);

  const activeAgents = agents.filter((a) => messages.some((m) => m.agentName === a.name));
  const agentCount = activeAgents.length;
  const selectedSections = SECTION_CONFIG.filter(({ key }) => options[key]).length;

  // Phase 1: Pre-fill analysis — each agent re-analyzes without asking questions
  const runPreAnalysis = async (): Promise<typeof messages> => {
    const newMessages: typeof messages = [...messages];
    let agentIdx = 0;

    for (const agent of activeAgents) {
      setAnalysisProgress(`Analyzing with ${agent.name} (${++agentIdx}/${activeAgents.length})...`);

      const agentMsgs = messages.filter((m) => m.agentName === agent.name || !m.agentName);
      const conversationText = agentMsgs
        .map((m) => `[${m.role}${m.agentName ? ` - ${m.agentName}` : ''}]: ${m.content}`)
        .join('\n\n');

      const srAnalysisPrompt = `You are ${agent.name}, ${agent.division} specialist at YEOO SOFTWARE.

Below is the conversation about the project "${projectName}". 

=== CONVERSATION HISTORY ===
${conversationText.substring(0, 12000)}

=== YOUR TASK ===
Based on the conversation above, produce a COMPLETE, CONCRETE requirements analysis for this project. Do NOT ask questions. Fill any gaps with your best professional judgment.

Format your response EXACTLY like this for each requirement:

RF-XX: [Brief name of the requirement]
[Detailed description: what the system should do, screens, fields, buttons, validation, user roles involved]
Prioridad: [Alta/Media/Baja]

Include at least ${options.maxReqsPerAgent} requirements. Also include:
- Non-functional requirements (performance, security, scalability)
- Key risks and mitigation strategies
- Time estimates where possible

Use the SRD format from the Memory Bank if available. Be thorough — this will go directly into the requirements document.`;

      try {
        const { prompt: agentPrompt } = agent;
        const response = await generateWithProvider(provider, {
          model,
          prompt: srAnalysisPrompt,
          system: `${agentPrompt}\n\nIMPORTANT: You are generating a Software Requirements Document. Do NOT ask questions. Do NOT say "I can help with that". Provide ONLY concrete, actionable requirements in RF-XX format. Fill gaps with professional assumptions.`,
          temperature: 0.3,
        });

        newMessages.push({
          role: 'assistant',
          content: response,
          agentName: agent.name,
          timestamp: new Date().toISOString(),
        } as any);
      } catch (e) {
        console.warn(`Pre-analysis failed for ${agent.name}:`, e);
      }
    }

    return newMessages;
  };

  const handleGenerate = async () => {
    const anySelected = SECTION_CONFIG.some(({ key }) => options[key]);
    if (!anySelected) {
      setError('Select at least one section to include.');
      setStatus('error');
      return;
    }

    // Phase 1: Analysis
    setStatus('analyzing');
    setError(null);
    try {
      const enriched = await runPreAnalysis();
      setEnrichedMessages(enriched);

      // Phase 2: Generate document
      setStatus('generating');
      const blob = await srdGenerator.generateSrd({
        projectName,
        agents: activeAgents,
        messages: enriched,
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
    if (!anySelected) { setError('Select at least one section.'); setStatus('error'); return; }

    setStatus('analyzing');
    setError(null);
    try {
      const enriched = enrichedMessages.length > 0 ? enrichedMessages : await runPreAnalysis();
      setStatus('generating');
      const blob = await srdGenerator.generateSrd({
        projectName,
        agents: activeAgents,
        messages: enriched,
        options,
      });
      const link = await googleDriveService.uploadFile(`SRD_${projectName.replace(/\s+/g, '_')}.docx`, blob);
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
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2"><XCircle size={20} /></button>
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
              <span className="text-gray-400">Sections</span>
              <span className="text-white font-bold">{selectedSections}</span>
            </div>
          </div>

          {(status === 'config') && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <SlidersHorizontal size={16} className="text-purple-400" />
                <span>Sections to include</span>
              </div>
              <div className="space-y-1.5">
                {SECTION_CONFIG.map(({ key, label }) => (
                  <button key={key} onClick={() => toggleOption(key)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${options[key] ? 'bg-purple-500/10 border-purple-500/30 text-white' : 'bg-[#1A1F2E] border-[#2D3548] text-gray-500 hover:text-gray-300'}`}>
                    {options[key] ? <CheckSquare size={18} className="text-purple-400 flex-shrink-0" /> : <Square size={18} className="text-gray-600 flex-shrink-0" />}
                    <span className="text-sm">{label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1F2937]">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Max reqs / agent</label>
                  <select className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg p-2.5 text-white text-sm"
                    value={options.maxReqsPerAgent} onChange={(e) => setOptions((p) => ({ ...p, maxReqsPerAgent: parseInt(e.target.value) }))}>
                    <option value={3}>3</option><option value={5}>5</option><option value={8}>8</option><option value={12}>12</option><option value={20}>20 (all)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Analysis detail</label>
                  <select className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg p-2.5 text-white text-sm"
                    value={options.maxAnalysisChars} onChange={(e) => setOptions((p) => ({ ...p, maxAnalysisChars: parseInt(e.target.value) }))}>
                    <option value={500}>Brief (500)</option><option value={1000}>Standard (1K)</option><option value={2000}>Detailed (2K)</option><option value={4000}>Full (4K)</option>
                  </select>
                </div>
              </div>

              <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                <p className="text-[11px] text-purple-300 flex items-center gap-2">
                  <Brain size={14} /> <strong>2-phase generation:</strong> Each agent will first analyze the conversation and produce structured requirements, then the document is generated from that enriched analysis.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button onClick={handleGenerate} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                  <Download size={18} /> Analyze & Download .docx
                </button>
                <button onClick={handleUploadToDrive} className="w-full bg-[#1A1F2E] text-gray-400 border border-[#2D3548] hover:bg-[#2D3548] font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                  <Cloud size={18} /> Upload to Google Drive
                </button>
              </div>
            </div>
          )}

          {status === 'analyzing' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex items-center gap-2">
                <Brain size={20} className="animate-pulse text-purple-400" />
                <span className="text-gray-300 font-medium">Phase 1: Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-purple-400" />
                <span className="text-gray-400 text-sm">{analysisProgress || 'Analyzing conversation...'}</span>
              </div>
              <p className="text-[11px] text-gray-500">Each agent is producing structured requirements. No questions asked.</p>
            </div>
          )}

          {status === 'generating' && (
            <div className="flex items-center justify-center gap-3 py-6">
              <Loader2 size={24} className="animate-spin text-purple-400" />
              <span className="text-gray-400">Generating document...</span>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#22C55E] bg-[#22C55E]/10 p-3 rounded-xl">
                <CheckCircle size={18} /><span className="text-sm">SRD generated!</span>
              </div>
              {downloaded && <p className="text-xs text-gray-500">.docx downloaded.</p>}
              {driveLink && <a href={driveLink} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-[#1A1F2E] text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 py-2.5 rounded-xl text-sm transition-all">📄 Open in Google Drive</a>}
              <button onClick={() => { setStatus('config'); setDriveLink(null); setDownloaded(false); setEnrichedMessages([]); }} className="w-full bg-[#1A1F2E] text-gray-400 border border-[#2D3548] py-2 rounded-xl text-sm hover:bg-[#2D3548] transition-all">Generate Again</button>
            </div>
          )}

          {status === 'error' && error && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-xl"><XCircle size={18} /><span className="text-sm">{error}</span></div>
              <button onClick={() => setStatus('config')} className="w-full bg-[#1A1F2E] text-gray-400 border border-[#2D3548] py-2 rounded-xl text-sm hover:bg-[#2D3548] transition-all">Retry</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};