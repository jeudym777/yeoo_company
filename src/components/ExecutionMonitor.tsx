import React, { useState, useRef, useEffect } from 'react';
import type { ExecutionNode, ExecutionResult, OrgAgent, Provider } from '../types';
import { generateWithProvider } from '../services/provider-router';
import { CEOServiceInstance } from '../services/ceo';
import { Play, Download, RotateCcw, ChevronRight, CheckCircle, XCircle, Loader2, FileText } from 'lucide-react';
import { downloadExecutivePDF } from '../services/pdfGenerator';

interface ExecutionMonitorProps {
  orgName: string;
  problem: string;
  agents: OrgAgent[];
  provider: Provider;
  model: string;
  onBack: () => void;
}

export const ExecutionMonitor: React.FC<ExecutionMonitorProps> = ({
  orgName,
  problem,
  agents,
  provider,
  model,
  onBack,
}) => {
  const [result, setResult] = useState<ExecutionResult>({
    nodes: [],
    finalReport: '',
    status: 'idle',
  });
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef(false);

  const buildExecutionOrder = (): OrgAgent[] => {
    // CEO first, then directors by department, then specialists
    const ceo = agents.filter((a) => a.parentId === null);
    const others = agents.filter((a) => a.parentId !== null);
    // Group by department
    const deptOrder: OrgAgent[] = [];
    const processedDepts = new Set<string>();

    for (const agent of others) {
      if (!processedDepts.has(agent.division)) {
        processedDepts.add(agent.division);
        // Add agents from this department
        const deptAgents = others.filter((a) => a.division === agent.division);
        deptOrder.push(...deptAgents);
      }
    }

    return [...ceo, ...deptOrder];
  };

  const executeOrganization = async () => {
    setIsRunning(true);
    abortRef.current = false;

    const order = buildExecutionOrder();
    const nodes: ExecutionNode[] = order.map((a) => ({
      agentId: a.id,
      agentName: a.name,
      emoji: a.emoji,
      status: 'pending' as const,
      progress: 0,
      input: '',
      output: '',
    }));

    setResult({ nodes, finalReport: '', status: 'running' });

    let globalContext = `BUSINESS PROBLEM: ${problem}`;
    const completedOutputs: { name: string; role: string; output: string }[] = [];

    for (let i = 0; i < order.length; i++) {
      if (abortRef.current) {
        nodes[i].status = 'error';
        nodes[i].error = 'Cancelled by user';
        setResult((prev) => ({ ...prev, nodes: [...prev.nodes] }));
        break;
      }

      const agent = order[i];
      const nodeIdx = nodes.findIndex((n) => n.agentId === agent.id);
      nodes[nodeIdx].status = 'running';
      nodes[nodeIdx].progress = 0;
      nodes[nodeIdx].input = globalContext;
      setResult((prev) => ({ ...prev, nodes: [...prev.nodes] }));

      // Simulate progress
      const progressInterval = setInterval(() => {
        if (nodes[nodeIdx].progress < 90) {
          nodes[nodeIdx].progress += Math.random() * 15;
          if (nodes[nodeIdx].progress > 90) nodes[nodeIdx].progress = 90;
          setResult((prev) => ({ ...prev, nodes: [...prev.nodes] }));
        }
      }, 300);

      try {
        const systemPrompt = `${agent.prompt}
${agent.context ? `ADDITIONAL CONTEXT: ${agent.context}` : ''}

You are ${agent.name}, ${agent.role} at ${orgName}.
Previous analysis context: ${globalContext}

Provide your expert analysis, recommendations, or deliverables based on your role. Be thorough and specific.`;

        const response = await generateWithProvider(provider, {
          model: agent.model,
          prompt: globalContext,
          system: systemPrompt,
          temperature: 0.7,
        });

        clearInterval(progressInterval);
        nodes[nodeIdx].status = 'completed';
        nodes[nodeIdx].progress = 100;
        nodes[nodeIdx].output = response;

        completedOutputs.push({
          name: agent.name,
          role: agent.role,
          output: response,
        });

        // Update global context for next agents
        globalContext = `ORIGINAL PROBLEM: ${problem}\n\nCompleted analysis by ${agent.name} (${agent.role}):\n${response}\n\nContinue with your analysis.`;
      } catch (error) {
        clearInterval(progressInterval);
        nodes[nodeIdx].status = 'error';
        nodes[nodeIdx].progress = 0;
        nodes[nodeIdx].error = error instanceof Error ? error.message : 'Unknown error';
      }

      setResult((prev) => ({ ...prev, nodes: [...prev.nodes] }));
    }

    // Generate final executive report
    if (!abortRef.current) {
      try {
        const report = await CEOServiceInstance.generateExecutiveReport(
          provider,
          model,
          problem,
          completedOutputs
        );
        setResult((prev) => ({ ...prev, finalReport: report, status: 'completed' }));
      } catch (error) {
        setResult((prev) => ({ ...prev, status: 'error' }));
      }
    }

    setIsRunning(false);
  };

  const handleCancel = () => {
    abortRef.current = true;
    setIsRunning(false);
  };

  const handleDownloadPDF = () => {
    if (!result.finalReport) return;
    
    const nodesAsAgentOutputs = result.nodes
      .filter((n) => n.output)
      .map((n) => ({
        name: n.agentName,
        role: n.status,
        output: n.output || '',
      }));

    downloadExecutivePDF({
      projectName: orgName,
      reportText: `# Organization Execution Report\n\n## Problem\n${problem}\n\n${result.finalReport}`,
      agentOutputs: nodesAsAgentOutputs,
      totalMessages: result.nodes.length,
    });
  };

  const getAgentAvatar = (agentId: string): string | undefined => {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.avatarUrl;
  };

  const progressBars = result.nodes.map((node) => {
    const avatarUrl = getAgentAvatar(node.agentId);
    return (
    <div key={node.agentId} className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            <img src={avatarUrl} alt={node.agentName} className="w-8 h-8 rounded-lg object-cover border border-[#2D3548]" />
          ) : (
            <span className="text-lg">{node.emoji}</span>
          )}
          <div>
            <p className="text-white font-medium text-sm">{node.agentName}</p>
            <p className="text-xs text-gray-500">{node.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {node.status === 'completed' && <CheckCircle size={18} className="text-[#22C55E]" />}
          {node.status === 'error' && <XCircle size={18} className="text-red-500" />}
          {node.status === 'running' && <Loader2 size={18} className="animate-spin text-red-400" />}
          {node.status === 'pending' && <div className="w-[18px]" />}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#0A0A0A] rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            node.status === 'completed' ? 'bg-[#22C55E]' :
            node.status === 'error' ? 'bg-red-500' :
            'bg-red-500'
          }`}
          style={{ width: `${node.progress}%` }}
        />
      </div>

      {node.error && (
        <p className="text-xs text-red-400 mt-2">{node.error}</p>
      )}
    </div>
  )});

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{orgName}</h1>
            <p className="text-gray-400 mt-1">Execution Pipeline</p>
          </div>
          <div className="flex gap-2">
            {result.status === 'completed' && (
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30 px-4 py-2 rounded-xl hover:bg-[#22C55E]/20 transition-all"
              >
                <Download size={16} />
                Export PDF
              </button>
            )}
            {!isRunning && result.status === 'idle' && (
              <button
                onClick={executeOrganization}
                className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-900 600 hover:from-red-500 hover:to-red-900 500 text-white font-bold px-6 py-2 rounded-xl transition-all"
              >
                <Play size={16} />
                Launch Organization
              </button>
            )}
            {isRunning && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/30 px-4 py-2 rounded-xl hover:bg-red-500/20 transition-all"
              >
                <XCircle size={16} />
                Cancel
              </button>
            )}
            <button
              onClick={onBack}
              className="flex items-center gap-2 bg-[#1A1F2E] text-gray-400 border border-[#2D3548] px-4 py-2 rounded-xl hover:bg-[#2D3548] transition-all"
            >
              <RotateCcw size={16} />
              Back
            </button>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <ChevronRight size={14} />
            Agent Execution Progress
          </h2>
          {progressBars}
        </div>

        {/* Final Report */}
        {result.finalReport && (
          <div className="bg-[#111827] border border-[#2D3548] rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-red-400" />
              <h2 className="text-xl font-bold text-white">Executive Report</h2>
            </div>
            <div className="bg-[#0A0A0A] border border-[#1F2937] rounded-xl p-6">
              <div className="prose prose-invert max-w-none text-gray-300 text-sm whitespace-pre-wrap">
                {result.finalReport}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};