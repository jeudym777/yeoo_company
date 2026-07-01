import React, { useState } from 'react';
import type { Agent, Provider } from '../types';
import { srdGenerator } from '../services/srd-generator';
import { googleDriveService } from '../services/google-drive';
import { generateWithProvider } from '../services/provider-router';
import { FileText, Download, Cloud, Loader2, CheckCircle, XCircle, CheckSquare, Square, SlidersHorizontal, Brain, Send, MessageCircle } from 'lucide-react';

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

interface AgentQuestion {
  agentName: string;
  question: string;
  answer: string;
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
  const [status, setStatus] = useState<'config' | 'analyzing' | 'awaiting_input' | 're_analyzing' | 'generating' | 'done' | 'error'>('config');
  const [options, setOptions] = useState<SrdOptions>(DEFAULT_OPTIONS);
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [questions, setQuestions] = useState<AgentQuestion[]>([]);
  const [quickAnswer, setQuickAnswer] = useState('');
  const [enrichedMessages, setEnrichedMessages] = useState<typeof messages>([]);
  const [answeringIndex, setAnsweringIndex] = useState<number | null>(null);

  const activeAgents = agents.filter((a) => messages.some((m) => m.agentName === a.name));
  const agentCount = activeAgents.length;
  const selectedSections = SECTION_CONFIG.filter(({ key }) => options[key]).length;

  const parseQuestions = (text: string): string[] => {
    const qs: string[] = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const m = line.match(/\[QUESTION\]\s*(.+)/i);
      if (m) qs.push(m[1].trim());
    }
    return qs;
  };

  // Phase 1: Initial analysis — each agent may raise [QUESTION]s
  const runInitialAnalysis = async (): Promise<{ questions: AgentQuestion[]; msgs: typeof messages }> => {
    const allQuestions: AgentQuestion[] = [];
    const newMessages: typeof messages = [...messages];
    let agentIdx = 0;

    for (const agent of activeAgents) {
      setAnalysisProgress(`Analyzing with ${agent.name} (${++agentIdx}/${activeAgents.length})...`);

      const agentMsgs = messages.filter((m) => m.agentName === agent.name || !m.agentName);
      const conversationText = agentMsgs
        .map((m) => `[${m.role}${m.agentName ? ` - ${m.agentName}` : ''}]: ${m.content}`)
        .join('\n\n');

      const prompt = `You are ${agent.name}, ${agent.division} specialist at YEOO SOFTWARE.

Project: "${projectName}"

=== CONVERSATION HISTORY ===
${conversationText.substring(0, 8000)}

=== YOUR TASK ===
Produce requirements for this project. If ANY critical information is missing, mark each gap with [QUESTION] on its own line followed by a clear, specific question. ONLY mark truly blocking gaps — do not over-question.

Example:
[QUESTION] What is the target hardware: on-premise server, cloud, or edge device like NVIDIA Jetson?

If you have enough information, provide requirements in this format:
RF-XX: [Short name]
[Description — screens, fields, validation, user roles]
Prioridad: [Alta/Media/Baja]

Be concise. Limit to ${options.maxReqsPerAgent} requirements total. Include non-functional, risks, and time estimates.`;

      try {
        const response = await generateWithProvider(provider, {
          model,
          prompt,
          system: `${agent.prompt}\n\nCRITICAL: Mark gaps with [QUESTION]. Do NOT ask open-ended "what do you need?" questions. Be laser-focused on specific missing details. If you know enough to fill the gap with professional assumptions, DO that instead.`,
          temperature: 0.3,
        });

        const qs = parseQuestions(response);
        qs.forEach((q) => allQuestions.push({ agentName: agent.name, question: q, answer: '' }));

        newMessages.push({
          role: 'assistant',
          content: response,
          agentName: agent.name,
          timestamp: new Date().toISOString(),
        } as any);
      } catch (e) {
        console.warn(`Analysis failed for ${agent.name}:`, e);
      }
    }

    return { questions: allQuestions, msgs: newMessages };
  };

  // Phase 2: Re-analyze with user answers
  const runFinalAnalysis = async (baseMessages: typeof messages, answeredQs: AgentQuestion[]): Promise<typeof messages> => {
    const finalMsgs = [...baseMessages];
    let agentIdx = 0;

    // Build context from answers
    const answerContext = answeredQs
      .filter((q) => q.answer.trim())
      .map((q) => `Q (${q.agentName}): ${q.question}\nA: ${q.answer}`)
      .join('\n\n');

    for (const agent of activeAgents) {
      setAnalysisProgress(`Re-analyzing with ${agent.name} (${++agentIdx}/${activeAgents.length})...`);

      const agentMsgs = messages.filter((m) => m.agentName === agent.name || !m.agentName);
      const conversationText = agentMsgs
        .map((m) => `[${m.role}${m.agentName ? ` - ${m.agentName}` : ''}]: ${m.content}`)
        .join('\n\n');

      const prompt = `You are ${agent.name}, ${agent.division} at YEOO SOFTWARE.

Project: "${projectName}"

=== CONVERSATION ===
${conversationText.substring(0, 6000)}

=== USER ANSWERS TO CLARIFYING QUESTIONS ===
${answerContext || 'All questions were answered with: proceed with best professional judgment.'}

=== YOUR TASK ===
Now produce the FINAL requirements document. NO questions. ONLY concrete requirements.

Format:
RF-XX: [Short name]
[Description]
Prioridad: [Alta/Media/Baja]

Include ${options.maxReqsPerAgent} requirements, risks, time estimates. Be thorough.`;

      try {
        const response = await generateWithProvider(provider, {
          model,
          prompt,
          system: `${agent.prompt}\n\nFINAL REQUIREMENTS DOCUMENT. No questions. No "I can help". ONLY RF-XX formatted requirements.`,
          temperature: 0.2,
        });

        finalMsgs.push({
          role: 'assistant',
          content: response,
          agentName: agent.name,
          timestamp: new Date().toISOString(),
        } as any);
      } catch (e) {
        console.warn(`Final analysis failed for ${agent.name}:`, e);
      }
    }

    return finalMsgs;
  };

  const handleStart = async () => {
    const anySelected = SECTION_CONFIG.some(({ key }) => options[key]);
    if (!anySelected) { setError('Select at least one section.'); setStatus('error'); return; }

    setStatus('analyzing');
    setError(null);
    try {
      const result = await runInitialAnalysis();
      setEnrichedMessages(result.msgs);
      
      if (result.questions.length > 0) {
        setQuestions(result.questions);
        setStatus('awaiting_input');
      } else {
        // No questions — generate directly
        setStatus('generating');
        await generateAndDownload(result.msgs);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
      setStatus('error');
    }
  };

  const handleAnswerSubmit = async () => {
    if (!quickAnswer.trim() && answeringIndex === null) return;
    
    // Apply answer to the selected question
    if (answeringIndex !== null && quickAnswer.trim()) {
      setQuestions((prev) => prev.map((q, i) => i === answeringIndex ? { ...q, answer: quickAnswer } : q));
      setQuickAnswer('');
      setAnsweringIndex(null);
    }
  };

  const handleSkipQuestions = async () => {
    setStatus('re_analyzing');
    try {
      const finalMsgs = await runFinalAnalysis(enrichedMessages, questions);
      setEnrichedMessages(finalMsgs);
      setStatus('generating');
      await generateAndDownload(finalMsgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Final analysis failed');
      setStatus('error');
    }
  };

  const handleContinueWithAnswers = async () => {
    setStatus('re_analyzing');
    try {
      const finalMsgs = await runFinalAnalysis(enrichedMessages, questions);
      setEnrichedMessages(finalMsgs);
      setStatus('generating');
      await generateAndDownload(finalMsgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Final analysis failed');
      setStatus('error');
    }
  };

  const generateAndDownload = async (msgs: typeof messages) => {
    const blob = await srdGenerator.generateSrd({ projectName, agents: activeAgents, messages: msgs, options });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SRD_${projectName.replace(/\s+/g, '_')}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setStatus('done');
  };

  const handleUpload = async () => {
    const anySelected = SECTION_CONFIG.some(({ key }) => options[key]);
    if (!anySelected) { setError('Select at least one section.'); setStatus('error'); return; }

    setStatus('analyzing');
    setError(null);
    try {
      const result = await runInitialAnalysis();
      let finalMsgs = result.msgs;

      if (result.questions.length > 0) {
        setQuestions(result.questions);
        setEnrichedMessages(result.msgs);
        setStatus('awaiting_input');
        return; // Wait for user
      }

      setStatus('generating');
      const blob = await srdGenerator.generateSrd({ projectName, agents: activeAgents, messages: finalMsgs, options });
      const link = await googleDriveService.uploadFile(`SRD_${projectName.replace(/\s+/g, '_')}.docx`, blob);
      setDriveLink(link);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setStatus('error');
    }
  };

  const toggleOption = (key: keyof SrdOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const unansweredCount = questions.filter((q) => !q.answer.trim()).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827] border border-[#2D3548] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#1F2937] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-900 600 flex items-center justify-center">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">SRD Generator</h3>
              <p className="text-sm text-gray-400">{projectName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2"><XCircle size={20} /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {status === 'config' && (
            <div className="space-y-3">
              <div className="bg-[#0A0A0A] border border-[#1F2937] rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-400">Agents</span><span className="text-white font-bold">{agentCount}/{agents.length}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">Messages</span><span className="text-white font-bold">{messages.length}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">Sections</span><span className="text-white font-bold">{selectedSections}</span></div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-400"><SlidersHorizontal size={16} className="text-red-400" /> Sections</div>
              <div className="space-y-1.5">
                {SECTION_CONFIG.map(({ key, label }) => (
                  <button key={key} onClick={() => toggleOption(key)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left ${options[key] ? 'bg-red-500/10 border-red-500/30 text-white' : 'bg-[#1A1F2E] border-[#2D3548] text-gray-500 hover:text-gray-300'}`}>
                    {options[key] ? <CheckSquare size={18} className="text-red-400 flex-shrink-0" /> : <Square size={18} className="text-gray-600 flex-shrink-0" />}
                    <span className="text-sm">{label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1F2937]">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Max reqs / agent</label>
                  <select className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg p-2.5 text-white text-sm" value={options.maxReqsPerAgent}
                    onChange={(e) => setOptions((p) => ({ ...p, maxReqsPerAgent: parseInt(e.target.value) }))}>
                    <option value={3}>3</option><option value={5}>5</option><option value={8}>8</option><option value={12}>12</option><option value={20}>20</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Detail</label>
                  <select className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg p-2.5 text-white text-sm" value={options.maxAnalysisChars}
                    onChange={(e) => setOptions((p) => ({ ...p, maxAnalysisChars: parseInt(e.target.value) }))}>
                    <option value={500}>Brief</option><option value={1000}>Standard</option><option value={2000}>Detailed</option><option value={4000}>Full</option>
                  </select>
                </div>
              </div>

              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                <p className="text-[11px] text-red-300 flex items-center gap-2">
                  <Brain size={14} /> <strong>Interactive SRD:</strong> Agents analyze → ask questions → you answer → final doc.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button onClick={handleStart} className="w-full bg-gradient-to-r from-red-600 to-red-900 600 hover:from-red-500 hover:to-red-900 500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                  <Download size={18} /> Start Analysis
                </button>
                <button onClick={handleUpload} className="w-full bg-[#1A1F2E] text-gray-400 border border-[#2D3548] hover:bg-[#2D3548] font-medium py-3 rounded-xl flex items-center justify-center gap-2">
                  <Cloud size={18} /> Upload to Drive
                </button>
              </div>
            </div>
          )}

          {status === 'analyzing' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Brain size={24} className="animate-pulse text-red-400" />
              <div className="flex items-center gap-2"><Loader2 size={16} className="animate-spin text-red-400" /><span className="text-gray-400 text-sm">{analysisProgress}</span></div>
              <p className="text-[11px] text-gray-500">Agents are analyzing and may raise questions...</p>
            </div>
          )}

          {status === 're_analyzing' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Brain size={24} className="animate-pulse text-green-400" />
              <div className="flex items-center gap-2"><Loader2 size={16} className="animate-spin text-green-400" /><span className="text-gray-400 text-sm">{analysisProgress}</span></div>
              <p className="text-[11px] text-gray-500">Re-analyzing with your answers...</p>
            </div>
          )}

          {/* Interactive: Agent Questions + Quick Answer */}
          {status === 'awaiting_input' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-amber-400" />
                <span className="text-amber-300 font-medium">Agents have {unansweredCount} question{unansweredCount !== 1 ? 's' : ''}</span>
              </div>
              <p className="text-[11px] text-gray-500">Answer below or click "Skip All" to let agents proceed with assumptions.</p>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {questions.map((q, i) => (
                  <div key={i} className="bg-[#0A0A0A] border border-[#1F2937] rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-[10px] text-red-400 font-semibold">{q.agentName}</p>
                        <p className="text-xs text-gray-300 mt-0.5">{q.question}</p>
                      </div>
                    </div>
                    {q.answer ? (
                      <div className="bg-green-500/10 border border-green-500/20 rounded p-2">
                        <p className="text-[11px] text-green-400">✓ {q.answer}</p>
                        <button onClick={() => {
                          setQuestions((prev) => prev.map((x, j) => j === i ? { ...x, answer: '' } : x));
                        }} className="text-[9px] text-gray-500 hover:text-gray-300 mt-1 cursor-pointer">Edit</button>
                      </div>
                    ) : answeringIndex === i ? (
                      <div className="flex gap-2">
                        <input
                          value={quickAnswer}
                          onChange={(e) => setQuickAnswer(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAnswerSubmit(); }}
                          placeholder="Your answer..."
                          className="flex-1 bg-[#1A1F2E] border border-[#2D3548] rounded-lg p-2 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-red-500"
                          autoFocus
                        />
                        <button onClick={handleAnswerSubmit} className="bg-red-600 text-white p-2 rounded-lg"><Send size={12} /></button>
                        <button onClick={() => { setAnsweringIndex(null); setQuickAnswer(''); }} className="text-gray-500 p-2">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setAnsweringIndex(i)}
                        className="text-[11px] text-red-400 hover:text-red-300 cursor-pointer mt-1">
                        + Answer
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleSkipQuestions}
                  className="flex-1 bg-[#1A1F2E] text-gray-400 border border-[#2D3548] hover:bg-[#2D3548] py-2.5 rounded-lg text-sm transition">
                  Skip All (Use Assumptions)
                </button>
                <button onClick={handleContinueWithAnswers}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-900 600 hover:from-red-500 hover:to-red-900 500 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
                  <Download size={16} /> Continue with Answers
                </button>
              </div>
            </div>
          )}

          {status === 'generating' && (
            <div className="flex items-center justify-center gap-3 py-6">
              <Loader2 size={24} className="animate-spin text-red-400" />
              <span className="text-gray-400">Generating document...</span>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#22C55E] bg-[#22C55E]/10 p-3 rounded-xl">
                <CheckCircle size={18} /><span className="text-sm">SRD generated!</span>
              </div>
              {downloaded && <p className="text-xs text-gray-500">.docx downloaded.</p>}
              {driveLink && <a href={driveLink} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-[#1A1F2E] text-red-400 border border-red-500/30 hover:bg-red-500/10 py-2.5 rounded-xl text-sm transition-all">📄 Open in Google Drive</a>}
              <button onClick={() => { setStatus('config'); setDriveLink(null); setDownloaded(false); setQuestions([]); setEnrichedMessages([]); }}
                className="w-full bg-[#1A1F2E] text-gray-400 border border-[#2D3548] py-2 rounded-xl text-sm hover:bg-[#2D3548] transition-all">
                New Document
              </button>
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