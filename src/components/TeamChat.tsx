import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Agent, Provider } from '../types';
import type { ChatMessage, SavedProject } from '../services/storage';
import { storageService } from '../services/storage';
import { avatarService } from '../services/avatar';
import OllamaService from '../services/ollama';
import DeepSeekService from '../services/deepseek';
import GroqService from '../services/groq';
import GeminiService from '../services/gemini';
import { CEOServiceInstance } from '../services/ceo';
import { downloadExecutivePDF } from '../services/pdfGenerator';
import { Send, ArrowLeft, Download, FileText, Save, Loader2, Users, Crown, ClipboardList, CheckSquare, Square } from 'lucide-react';
import { SRDModal } from './SRDModal';
import MemoryBankPanel from './MemoryBankPanel';
import { memoryBankService } from '../services/memoryBank';

interface TeamChatProps {
  agents: Agent[];
  provider: Provider;
  model: string;
  teamName: string;
  projectId?: string;
  savedMessages?: ChatMessage[];
  onBack: () => void;
  onGoToProjects: () => void;
}

export const TeamChat: React.FC<TeamChatProps> = ({
  agents,
  provider,
  model,
  teamName,
  projectId,
  savedMessages,
  onBack,
  onGoToProjects,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(savedMessages || []);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [projectName, setProjectName] = useState(teamName);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [executiveReport, setExecutiveReport] = useState('');
  const [showSrdModal, setShowSrdModal] = useState(false);
  const [showMemoryBank, setShowMemoryBank] = useState(false);
  const stableProjectId = useRef(projectId || `proj-${Date.now()}`);
  const memoryBankContextRef = useRef('');

  // Agents selected to contribute to reports (default: all)
  const [reportSelectedAgents, setReportSelectedAgents] = useState<Set<string>>(
    new Set(agents.map((a) => a.id))
  );

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const [agentContexts, setAgentContexts] = useState<Record<string, string>>({});

  const reportSelectedCount = reportSelectedAgents.size;
  const totalAgents = agents.length;

  // Load Memory Bank content into context ref
  const loadMemoryBankContext = useCallback(async () => {
    try {
      const docs = await memoryBankService.getAllDocuments(stableProjectId.current);
      if (docs.length > 0) {
        memoryBankContextRef.current = docs
          .map((d) => `### ${memoryBankService.getLabel(d.docType)}\n${d.content}`)
          .join('\n\n');
      }
    } catch {}
  }, []);

  useEffect(() => {
    storageService.getAgentContexts().then(setAgentContexts);
    memoryBankService.initializeProject(stableProjectId.current).then(() => {
      loadMemoryBankContext();
    });
  }, [loadMemoryBankContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !selectedAgent || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      agentName: undefined,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);
    setConnectionError(null);

    try {
      const context = agentContexts[selectedAgent.id] || '';
      const memoryBankContext = memoryBankContextRef.current;
      
      let systemPrompt = `${selectedAgent.prompt}
${context ? `CUSTOM CONTEXT: ${context}` : ''}
You are ${selectedAgent.name} from the ${selectedAgent.division} division at YEOO Labs.
Provide expert, detailed analysis and recommendations. Be professional and thorough.`;

      // Inject Memory Bank as reference context for the agent
      if (memoryBankContext) {
        systemPrompt += `\n\n--- PROJECT MEMORY BANK (Reference Context) ---\n${memoryBankContext}\n--- END MEMORY BANK ---\n\nUse the Memory Bank above as reference for your analysis when relevant.`;
      }

      let response: string;
      const genOpts = { model, prompt: inputValue, system: systemPrompt, temperature: 0.7 };
      if (provider === 'ollama') response = await OllamaService.generate(genOpts);
      else if (provider === 'groq') response = await GroqService.generate(genOpts);
      else if (provider === 'gemini') response = await GeminiService.generate(genOpts);
      else response = await DeepSeekService.generate(genOpts);

      const assistantMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response,
        agentName: selectedAgent.name,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      setConnectionError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'system',
          content: `Error: ${errMsg}`,
          agentName: 'System',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProject = () => {
    const project: SavedProject = {
      id: stableProjectId.current,
      name: projectName || teamName,
      createdAt: new Date().toISOString(),
      provider,
      model,
      agents,
      messages,
      agentContexts,
    };
    storageService.saveProject(project);
    setConnectionError(null);
    alert('Project saved successfully!');
  };

  const toggleReportAgent = (agentId: string) => {
    setReportSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  // Filter agents that are selected AND have messages
  const getActiveReportAgents = useCallback(() => {
    return agents.filter(
      (a) => reportSelectedAgents.has(a.id) && messages.some((m) => m.agentName === a.name)
    );
  }, [agents, reportSelectedAgents, messages]);

  const getActiveReportAgentOutputs = useCallback(() => {
    return getActiveReportAgents().map((a) => ({
      name: a.name,
      role: a.division,
      output: messages
        .filter((m) => m.agentName === a.name)
        .map((m) => m.content)
        .join('\n'),
    }));
  }, [getActiveReportAgents, messages]);

  const handleGenerateReport = async () => {
    if (messages.length === 0) return;
    const activeAgents = getActiveReportAgents();
    if (activeAgents.length === 0) {
      setConnectionError('No agents selected for the report. Select at least one agent in the sidebar.');
      return;
    }
    setIsGeneratingReport(true);

    try {
      const conversationText = messages
        .filter((m) => m.agentName === undefined || activeAgents.some((a) => a.name === m.agentName))
        .map((m) => `[${m.role}${m.agentName ? ` - ${m.agentName}` : ''}]: ${m.content}`)
        .join('\n\n');

      const agentOutputs = getActiveReportAgentOutputs();

      // Inject Memory Bank into the problem/context for the CEO report
      const memoryBankContext = memoryBankContextRef.current;
      let problemWithContext = `Project: ${projectName}. Team conversation with ${activeAgents.map(a => a.name).join(', ')}.\n\n${conversationText.substring(0, 4000)}`;
      
      if (memoryBankContext) {
        problemWithContext += `\n\n--- PROJECT MEMORY BANK (Reference Context) ---\n${memoryBankContext}\n--- END MEMORY BANK ---`;
      }

      const report = await CEOServiceInstance.generateExecutiveReport(
        provider,
        model,
        problemWithContext,
        agentOutputs
      );
      setExecutiveReport(report);
      setShowReport(true);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadPDF = () => {
    const agentOutputs = getActiveReportAgentOutputs();
    downloadExecutivePDF({
      projectName: projectName || teamName,
      reportText: executiveReport,
      agentOutputs,
      totalMessages: messages.length,
    });
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-[#111827] border-b border-[#1F2937] p-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-[#1F2937] rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-gray-400" />
        </button>
        <div className="flex-1">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-transparent text-white font-bold text-lg focus:outline-none focus:border-b focus:border-purple-500 w-96"
          />
          <p className="text-xs text-gray-500">
            {agents.length} agents · {provider === 'groq' ? '⚡ Groq' : provider === 'gemini' ? '🌐 Gemini' : provider === 'deepseek' ? '☁️ DeepSeek' : '🖥️ Ollama'} · {model}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSaveProject}
            className="flex items-center gap-1.5 bg-[#1A1F2E] text-gray-400 border border-[#2D3548] px-3 py-1.5 rounded-lg hover:bg-[#2D3548] transition-all text-xs"
          >
            <Save size={14} />
            Save
          </button>
          <button
            onClick={() => setShowMemoryBank(true)}
            className="flex items-center gap-1.5 bg-[#1A1F2E] text-gray-400 border border-[#2D3548] px-3 py-1.5 rounded-lg hover:bg-[#2D3548] transition-all text-xs"
          >
            🧠 Memory Bank
          </button>
          <button
            onClick={() => setShowSrdModal(true)}
            disabled={messages.length === 0 || reportSelectedAgents.size === 0}
            className="flex items-center gap-1.5 bg-[#1A1F2E] text-gray-400 border border-[#2D3548] px-3 py-1.5 rounded-lg hover:bg-[#2D3548] transition-all text-xs disabled:opacity-50"
          >
            <ClipboardList size={14} />
            Requerimientos
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={isGeneratingReport || messages.length === 0 || reportSelectedAgents.size === 0}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1.5 rounded-lg hover:from-purple-500 hover:to-indigo-500 transition-all text-xs disabled:opacity-50"
          >
            {isGeneratingReport ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            Executive Report
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Agent Sidebar with Report Selection */}
        <div className="w-56 bg-[#0D1117] border-r border-[#1F2937] overflow-y-auto flex-shrink-0">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} className="text-purple-400" />
              <span className="text-xs font-semibold text-gray-400 uppercase">Team</span>
            </div>
            <p className="text-[10px] text-gray-500 mb-3">
              <span className="text-purple-400 font-bold">{reportSelectedCount}</span>/{totalAgents} for reports
            </p>
            {agents.map((agent) => {
              const isChatSelected = selectedAgentId === agent.id;
              const isReportSelected = reportSelectedAgents.has(agent.id);
              const hasMessages = messages.some((m) => m.agentName === agent.name);
              return (
                <div
                  key={agent.id}
                  className={`flex items-center gap-1 p-1.5 rounded-lg mb-1 transition-all ${
                    isChatSelected ? 'bg-purple-500/10 border border-purple-500/30' : 'hover:bg-[#1A1F2E]'
                  }`}
                >
                  {/* Report checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleReportAgent(agent.id);
                    }}
                    className={`flex-shrink-0 cursor-pointer transition-colors ${
                      isReportSelected ? 'text-purple-400' : 'text-gray-600 hover:text-gray-400'
                    }`}
                    title={isReportSelected ? 'Remove from reports' : 'Add to reports'}
                  >
                    {isReportSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>

                  {/* Agent click (select for chat) */}
                  <button
                    onClick={() => setSelectedAgentId(agent.id)}
                    className="flex items-center gap-1.5 flex-1 min-w-0"
                  >
                    <img
                      src={avatarService.getAvatarUrl(agent.id, agent.gender, agent.firstName, agent.lastName)}
                      alt={agent.name}
                      className="w-6 h-6 rounded-lg object-cover border border-[#2D3548]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate flex items-center gap-1">
                        {agent.name}
                        {agent.id === 'ceo-alex' && <Crown size={8} className="text-yellow-500" />}
                      </p>
                      <p className="text-[9px] text-gray-500 truncate">{agent.division}</p>
                    </div>
                    {hasMessages && (
                      <span className="text-[8px] text-gray-600 bg-[#1A1F2E] px-1 rounded">💬</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Active Agent Banner */}
          {selectedAgent && (
            <div className="bg-purple-500/5 border-b border-purple-500/20 px-4 py-2">
              <p className="text-xs text-purple-400">
                <strong>{selectedAgent.emoji} {selectedAgent.name}</strong> — {selectedAgent.description.substring(0, 100)}...
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <Users size={40} className="mx-auto mb-3 opacity-50" />
                  <p className="font-medium">{projectName}</p>
                  <p className="text-sm">Select an agent and start the conversation</p>
                  <p className="text-[10px] text-gray-600 mt-2">
                    ✓ Check agents in sidebar to include in reports
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-2xl px-4 py-2.5 rounded-xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : msg.role === 'system'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'bg-[#1A1F2E] text-gray-200 border border-[#2D3548]'
                    }`}
                  >
                    {msg.agentName && (
                      <p className="text-xs font-semibold mb-1 opacity-70">{msg.agentName}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#1A1F2E] border border-[#2D3548] px-4 py-2.5 rounded-xl flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-purple-400" />
                  <span className="text-sm text-gray-400">{selectedAgent?.name} is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#1F2937]">
            {connectionError && (
              <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
                {connectionError}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
                placeholder={`Ask ${selectedAgent?.name || 'an agent'}...`}
                className="flex-1 bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white p-2.5 rounded-xl transition-all"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Memory Bank Modal */}
      {showMemoryBank && (
        <MemoryBankPanel
          projectId={stableProjectId.current}
          projectName={projectName || teamName}
          onClose={() => {
            setShowMemoryBank(false);
            loadMemoryBankContext();
          }}
        />
      )}

      {/* SRD Modal — filter agents by report selection */}
      {showSrdModal && (
        <SRDModal
          projectName={projectName}
          agents={getActiveReportAgents()}
          messages={messages}
          provider={provider}
          model={model}
          onClose={() => setShowSrdModal(false)}
        />
      )}

      {showReport && executiveReport && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111827] border border-[#2D3548] rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#1F2937]">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-purple-400" />
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Executive Report
                  <span className="text-xs font-normal text-gray-500 bg-[#1A1F2E] px-2 py-0.5 rounded-full">
                    {getActiveReportAgents().length} agents
                  </span>
                </h2>
              </div>
              <div className="flex gap-2">
                <button onClick={handleDownloadPDF} className="flex items-center gap-1.5 bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30 px-3 py-1.5 rounded-lg text-xs hover:bg-[#22C55E]/20 transition-all">
                  <Download size={14} />
                  Download PDF
                </button>
                <button onClick={() => setShowReport(false)} className="text-gray-500 hover:text-white p-1">
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-invert max-w-none text-sm text-gray-300 whitespace-pre-wrap">
                {executiveReport}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};