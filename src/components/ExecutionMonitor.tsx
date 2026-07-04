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
  const [executionMode, setExecutionMode] = useState<'sequential' | 'parallel'>('sequential');
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

    const completedOutputs: { name: string; role: string; output: string }[] = [];

    if (executionMode === 'sequential') {
      // SEQUENTIAL EXECUTION (CASCADE)
      let globalContext = `BUSINESS PROBLEM: ${problem}`;

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
            setResult((prev) => {
              const nextNodes = [...prev.nodes];
              if (nextNodes[nodeIdx]) {
                nextNodes[nodeIdx] = { ...nextNodes[nodeIdx], progress: Math.round(nodes[nodeIdx].progress) };
              }
              return { ...prev, nodes: nextNodes };
            });
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
    } else {
      // HIERARCHICAL PARALLEL EXECUTION (BRANCHING)
      // Resolve tree levels:
      const levels: OrgAgent[][] = [];
      let remainingAgents = [...agents];

      // Level 0: CEO / Roots (no parent, or parent not in org)
      const level0 = remainingAgents.filter(
        (a) => !a.parentId || !agents.some((parent) => parent.id === a.parentId)
      );
      if (level0.length > 0) {
        levels.push(level0);
        remainingAgents = remainingAgents.filter((a) => !level0.includes(a));
      }

      // Consequent levels
      while (remainingAgents.length > 0) {
        const lastLevel = levels[levels.length - 1];
        if (!lastLevel || lastLevel.length === 0) {
          levels.push(remainingAgents);
          break;
        }
        const nextLevel = remainingAgents.filter((a) =>
          lastLevel.some((parent) => parent.id === a.parentId)
        );

        if (nextLevel.length === 0) {
          levels.push(remainingAgents);
          break;
        }

        levels.push(nextLevel);
        remainingAgents = remainingAgents.filter((a) => !nextLevel.includes(a));
      }

      // Execute each level in parallel, but levels sequentially
      const executeParallelAgent = async (agent: OrgAgent, contextInput: string) => {
        const nodeIdx = nodes.findIndex((n) => n.agentId === agent.id);
        if (nodeIdx === -1) return;

        setResult((prev) => {
          const nextNodes = [...prev.nodes];
          nextNodes[nodeIdx] = { ...nextNodes[nodeIdx], status: 'running', progress: 0, input: contextInput };
          return { ...prev, nodes: nextNodes };
        });

        let currentProgress = 0;
        const progressInterval = setInterval(() => {
          if (currentProgress < 90) {
            currentProgress += Math.random() * 15;
            if (currentProgress > 90) currentProgress = 90;
            setResult((prev) => {
              const nextNodes = [...prev.nodes];
              if (nextNodes[nodeIdx]) {
                nextNodes[nodeIdx] = { ...nextNodes[nodeIdx], progress: Math.round(currentProgress) };
              }
              return { ...prev, nodes: nextNodes };
            });
          }
        }, 300);

        try {
          const systemPrompt = `${agent.prompt}
${agent.context ? `ADDITIONAL CONTEXT: ${agent.context}` : ''}
You are ${agent.name}, ${agent.role} at ${orgName}.
Previous directive context: ${contextInput}

Provide your expert analysis, recommendations, or deliverables based on your role. Be thorough and specific.`;

          const response = await generateWithProvider(provider, {
            model: agent.model,
            prompt: contextInput,
            system: systemPrompt,
            temperature: 0.7,
          });

          clearInterval(progressInterval);
          nodes[nodeIdx].output = response;
          nodes[nodeIdx].status = 'completed';

          setResult((prev) => {
            const nextNodes = [...prev.nodes];
            if (nextNodes[nodeIdx]) {
              nextNodes[nodeIdx] = { ...nextNodes[nodeIdx], status: 'completed', progress: 100, output: response };
            }
            return { ...prev, nodes: nextNodes };
          });

          completedOutputs.push({
            name: agent.name,
            role: agent.role,
            output: response,
          });
        } catch (error) {
          clearInterval(progressInterval);
          const errStr = error instanceof Error ? error.message : 'Unknown error';
          nodes[nodeIdx].status = 'error';
          nodes[nodeIdx].error = errStr;

          setResult((prev) => {
            const nextNodes = [...prev.nodes];
            if (nextNodes[nodeIdx]) {
              nextNodes[nodeIdx] = { ...nextNodes[nodeIdx], status: 'error', progress: 0, error: errStr };
            }
            return { ...prev, nodes: nextNodes };
          });
        }
      };

      for (let l = 0; l < levels.length; l++) {
        if (abortRef.current) break;
        const currentLevelAgents = levels[l];

        await Promise.all(
          currentLevelAgents.map((agent) => {
            const parentAgent = agents.find((p) => p.id === agent.parentId);
            const parentNode = parentAgent ? nodes.find((n) => n.agentId === parentAgent.id) : null;
            const parentOutput = parentNode?.output || '';

            const contextInput = parentAgent
              ? `BUSINESS PROBLEM: ${problem}\n\nDIRECTIVE FROM SUPERVISOR (${parentAgent.name} - ${parentAgent.role}):\n${parentOutput}`
              : `BUSINESS PROBLEM: ${problem}`;

            return executeParallelAgent(agent, contextInput);
          })
        );
      }
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
            <div className="flex items-center gap-3 mt-1">
              <span className="text-gray-400 text-sm">Execution Pipeline</span>
              <span className="text-gray-600 text-xs">|</span>
              <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">
                {executionMode === 'sequential' ? '🔗 Secuencial' : '⚡ Paralelo (Bifurcado)'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Mode Toggle (only if idle) */}
            {!isRunning && result.status === 'idle' && (
              <div className="flex bg-[#111827] border border-[#1F2937] p-1 rounded-xl gap-1 mr-2">
                <button
                  onClick={() => setExecutionMode('sequential')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    executionMode === 'sequential'
                      ? 'bg-red-600 text-white shadow-md font-semibold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🔗 Secuencial
                </button>
                <button
                  onClick={() => setExecutionMode('parallel')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    executionMode === 'parallel'
                      ? 'bg-red-600 text-white shadow-md font-semibold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  ⚡ Paralelo
                </button>
              </div>
            )}
            {result.status === 'completed' && (
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30 px-4 py-2 rounded-xl hover:bg-[#22C55E]/20 transition-all text-sm animate-fade-in"
              >
                <Download size={16} />
                Export PDF
              </button>
            )}
            {!isRunning && result.status === 'idle' && (
              <button
                onClick={executeOrganization}
                className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-900 hover:from-red-500 hover:to-red-800 text-white font-bold px-6 py-2.5 rounded-xl transition-all text-sm shadow-lg shadow-red-900/20"
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