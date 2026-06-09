import React, { useState } from 'react';
import type { OrgAgent, OrgChart, Provider } from '../types';
import { AgentCardV2 } from './AgentCardV2';
import { ContextModal } from './ContextModal';
import { avatarService } from '../services/avatar';
import { Play, Plus, ChevronDown, ChevronRight, Layout, Users } from 'lucide-react';

interface OrgChartViewProps {
  orgChart: OrgChart;
  provider: Provider;
  availableModels: string[];
  onUpdateAgents: (agents: OrgAgent[]) => void;
  onLaunchExecution: () => void;
  onBack: () => void;
}

export const OrgChartView: React.FC<OrgChartViewProps> = ({
  orgChart,
  provider,
  availableModels,
  onUpdateAgents,
  onLaunchExecution,
  onBack,
}) => {
  // Ensure all agents have avatars assigned (handles orgs created before avatar system)
  const [agents, setAgents] = useState<OrgAgent[]>(() => 
    avatarService.assignAllAvatars(orgChart.agents)
  );
  const [contextAgent, setContextAgent] = useState<OrgAgent | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const ceo = agents.filter((a) => a.parentId === null);
  const departments = new Map<string, OrgAgent[]>();

  for (const agent of agents.filter((a) => a.parentId !== null)) {
    const dept = agent.division;
    if (!departments.has(dept)) {
      departments.set(dept, []);
    }
    departments.get(dept)!.push(agent);
  }

  // Auto-expand all departments on first load
  if (expandedDepts.size === 0 && departments.size > 0) {
    setExpandedDepts(new Set(departments.keys()));
  }

  const toggleDept = (dept: string) => {
    const next = new Set(expandedDepts);
    if (next.has(dept)) {
      next.delete(dept);
    } else {
      next.add(dept);
    }
    setExpandedDepts(next);
  };

  const handleEditAgent = (id: string, updates: Partial<OrgAgent>) => {
    const updated = agents.map((a) => (a.id === id ? { ...a, ...updates } : a));
    setAgents(updated);
    onUpdateAgents(updated);
  };

  const handleRemoveAgent = (id: string) => {
    const updated = agents.filter((a) => a.id !== id);
    setAgents(updated);
    onUpdateAgents(updated);
    setDeleteConfirm(null);
  };

  const handleContextSave = (agentId: string, context: string) => {
    const updated = agents.map((a) => (a.id === agentId ? { ...a, context } : a));
    setAgents(updated);
    onUpdateAgents(updated);
  };

  const handleChangeModel = (id: string, model: string) => {
    const updated = agents.map((a) => (a.id === id ? { ...a, model } : a));
    setAgents(updated);
    onUpdateAgents(updated);
  };

  const handleAddAgent = (deptName: string) => {
    const deptAgents = departments.get(deptName) || [];
    const existingAgent = deptAgents.length > 0 ? deptAgents[0] : null;

    const newAgent: OrgAgent = {
      id: `agent-new-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: 'New Agent',
      emoji: '🤖',
      role: 'Specialist',
      description: 'New team member',
      parentId: existingAgent?.parentId || null,
      model: availableModels[0] || 'deepseek-chat',
      context: '',
      skills: [],
      status: 'active',
      prompt: 'Execute your role with excellence.',
      division: deptName,
      avatarUrl: '',
      gender: undefined,
    };

    // Assign permanent avatar
    const agentWithAvatar = avatarService.assignAvatarToOrgAgent(newAgent);

    const updated = [...agents, agentWithAvatar];
    setAgents(updated);
    onUpdateAgents(updated);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-xl">
                🏢
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{orgChart.name}</h1>
                <p className="text-gray-400 text-sm mt-0.5">{orgChart.problem}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onBack}
              className="bg-[#1A1F2E] text-gray-400 border border-[#2D3548] px-4 py-2 rounded-xl hover:bg-[#2D3548] transition-all text-sm"
            >
              ← Back
            </button>
            <button
              onClick={onLaunchExecution}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-6 py-2 rounded-xl flex items-center gap-2 transition-all"
            >
              <Play size={16} />
              Launch Organization
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Layout size={18} className="text-purple-400" />
              <span className="text-sm text-gray-400">Departments</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">{departments.size}</p>
          </div>
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-purple-400" />
              <span className="text-sm text-gray-400">Agents</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">{agents.length}</p>
          </div>
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧠</span>
              <span className="text-sm text-gray-400">Provider</span>
            </div>
            <p className="text-lg font-bold text-white mt-1">
              {provider === 'deepseek' ? '☁️ DeepSeek' : '🖥️ Ollama'}
            </p>
          </div>
        </div>

        {/* CEO Level */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
            <ChevronRight size={14} />
            Executive
          </h2>
          <div className="flex flex-wrap gap-4">
            {ceo.map((agent) => (
              <AgentCardV2
                key={agent.id}
                agent={agent}
                provider={provider}
                availableModels={availableModels}
                onEdit={handleEditAgent}
                onRemove={handleRemoveAgent}
                onContext={(id) => setContextAgent(agents.find((a) => a.id === id) || null)}
                onChangeModel={handleChangeModel}
              />
            ))}
          </div>
        </div>

        {/* Connector Line */}
        <div className="flex justify-center">
          <div className="w-0.5 h-8 bg-[#2D3548]" />
        </div>

        {/* Departments */}
        <div className="space-y-8">
          {Array.from(departments.entries()).map(([deptName, deptAgents]) => (
            <div key={deptName}>
              {/* Department Header */}
              <button
                onClick={() => toggleDept(deptName)}
                className="flex items-center gap-2 mb-3 group"
              >
                {expandedDepts.has(deptName) ? (
                  <ChevronDown size={16} className="text-gray-400" />
                ) : (
                  <ChevronRight size={16} className="text-gray-400" />
                )}
                <span className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  {deptName}
                </span>
                <span className="text-xs text-gray-500 bg-[#1A1F2E] px-2 py-0.5 rounded-full">
                  {deptAgents.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddAgent(deptName);
                  }}
                  className="ml-auto text-gray-500 hover:text-purple-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Add Agent"
                >
                  <Plus size={16} />
                </button>
              </button>

              {/* Department Agents */}
              {expandedDepts.has(deptName) && (
                <div className="ml-6 pl-6 border-l-2 border-[#2D3548]">
                  <div className="flex flex-wrap gap-4">
                    {deptAgents.map((agent) => (
                      <AgentCardV2
                        key={agent.id}
                        agent={agent}
                        provider={provider}
                        availableModels={availableModels}
                        onEdit={handleEditAgent}
                        onRemove={handleRemoveAgent}
                        onContext={(id) => setContextAgent(agents.find((a) => a.id === id) || null)}
                        onChangeModel={handleChangeModel}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Context Modal */}
      {contextAgent && (
        <ContextModal
          agent={contextAgent}
          onSave={handleContextSave}
          onClose={() => setContextAgent(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111827] border border-[#2D3548] rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-bold text-lg mb-2">Remove Agent?</h3>
            <p className="text-gray-400 text-sm mb-4">
              This agent will be permanently removed from the organization.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-[#1A1F2E] text-gray-400 py-2 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveAgent(deleteConfirm)}
                className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 py-2 rounded-xl"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};