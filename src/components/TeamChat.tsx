import React, { useState, useRef, useEffect } from 'react';
import type { Agent, Provider } from '../types';
import type { ChatMessage, SavedProject } from '../services/storage';
import { storageService } from '../services/storage';
import { avatarService } from '../services/avatar';
import OllamaService from '../services/ollama';
import DeepSeekService from '../services/deepseek';
import { CEOServiceInstance } from '../services/ceo';
import jsPDF from 'jspdf';
import { Send, ArrowLeft, Download, FileText, Save, Loader2, Users, Crown } from 'lucide-react';

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

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const agentContexts = storageService.getAgentContexts();

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
      const systemPrompt = `${selectedAgent.prompt}
${context ? `CUSTOM CONTEXT: ${context}` : ''}
You are ${selectedAgent.name} from the ${selectedAgent.division} division at YEOO Labs.
Provide expert, detailed analysis and recommendations. Be professional and thorough.`;

      let response: string;
      if (provider === 'ollama') {
        response = await OllamaService.generate({
          model,
          prompt: inputValue,
          system: systemPrompt,
          temperature: 0.7,
        });
      } else {
        response = await DeepSeekService.generate({
          model,
          prompt: inputValue,
          system: systemPrompt,
          temperature: 0.7,
        });
      }

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
      id: projectId || `proj-${Date.now()}`,
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

  const handleGenerateReport = async () => {
    if (messages.length === 0) return;
    setIsGeneratingReport(true);

    try {
      const conversationText = messages
        .map((m) => `[${m.role}${m.agentName ? ` - ${m.agentName}` : ''}]: ${m.content}`)
        .join('\n\n');

      const agentOutputs = agents.map((a) => ({
        name: a.name,
        role: a.division,
        output: messages
          .filter((m) => m.agentName === a.name)
          .map((m) => m.content)
          .join('\n'),
      })).filter((a) => a.output.length > 0);

      const report = await CEOServiceInstance.generateExecutiveReport(
        provider,
        model,
        `Project: ${projectName}. Team conversation with ${agents.map(a => a.name).join(', ')}.\n\n${conversationText.substring(0, 4000)}`,
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
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    let y = 20;

    pdf.setTextColor(124, 58, 237);
    pdf.setFontSize(18);
    pdf.text('YEOO OS - Executive Report', 20, y);
    y += 10;
    pdf.setTextColor(100, 100, 100);
    pdf.setFontSize(10);
    pdf.text(`Project: ${projectName}`, 20, y);
    y += 6;
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, y);
    y += 10;
    pdf.setDrawColor(124, 58, 237);
    pdf.line(20, y, pageWidth - 20, y);
    y += 8;

    pdf.setTextColor(200, 200, 200);
    pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(executiveReport, pageWidth - 40);
    lines.forEach((line: string) => {
      if (y > 280) { pdf.addPage(); y = 20; }
      pdf.text(line, 20, y);
      y += 5;
    });

    pdf.save(`executive-report-${new Date().toISOString().split('T')[0]}.pdf`);
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
            {agents.length} agents · {provider === 'deepseek' ? '☁️ DeepSeek' : '🖥️ Ollama'} · {model}
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
            onClick={handleGenerateReport}
            disabled={isGeneratingReport || messages.length === 0}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1.5 rounded-lg hover:from-purple-500 hover:to-indigo-500 transition-all text-xs disabled:opacity-50"
          >
            {isGeneratingReport ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            Executive Report
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Agent Sidebar */}
        <div className="w-56 bg-[#0D1117] border-r border-[#1F2937] overflow-y-auto flex-shrink-0">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-purple-400" />
              <span className="text-xs font-semibold text-gray-400 uppercase">Team</span>
            </div>
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`w-full text-left p-2.5 rounded-lg mb-1 transition-all ${
                  selectedAgentId === agent.id
                    ? 'bg-purple-500/10 border border-purple-500/30 text-white'
                    : 'hover:bg-[#1A1F2E] text-gray-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <img
                    src={avatarService.getAvatarUrl(agent.id, agent.gender, agent.firstName, agent.lastName)}
                    alt={agent.name}
                    className="w-7 h-7 rounded-lg object-cover border border-[#2D3548]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate flex items-center gap-1">
                      {agent.name}
                      {agent.id === 'ceo-alex' && <Crown size={10} className="text-yellow-500" />}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">{agent.division}</p>
                  </div>
                </div>
              </button>
            ))}
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

      {/* Executive Report Modal */}
      {showReport && executiveReport && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111827] border border-[#2D3548] rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#1F2937]">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-purple-400" />
                <h2 className="text-lg font-bold text-white">Executive Report</h2>
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