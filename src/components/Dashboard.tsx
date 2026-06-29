import React, { useState, useEffect } from 'react';
import type { Agent, Provider } from '../types';
import { YEOO_DIVISIONS, getAgentsByDivision } from '../agents_yeoo';
import { avatarService } from '../services/avatar';
import { storageService } from '../services/storage';
import { agentService } from '../services/agent-service';
import { AgentContextModal } from './AgentContextModal';
import { Search, Filter, Users, ArrowRight, Check, FolderOpen, Settings2, Loader2 } from 'lucide-react';

interface DashboardProps {
  provider: Provider;
  model: string;
  onTeamSelect: (agents: Agent[], teamName: string) => void;
  onProjectsClick: () => void;
  onChangeConfig: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  provider,
  model,
  onTeamSelect,
  onProjectsClick,
  onChangeConfig,
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [contextAgent, setContextAgent] = useState<Agent | null>(null);
  const [contextBadges, setContextBadges] = useState<Record<string, boolean>>({});

  // Load agents from Supabase (with fallback to agents_yeoo.ts)
  useEffect(() => {
    const loadAgents = async () => {
      await agentService.seedDefaultAgents();
      const allAgents = await agentService.getAllAgents();
      setAgents(allAgents);
      setLoadingAgents(false);
    };
    loadAgents();
  }, []);

  // Load context badges on mount and when modal closes
  const refreshContextBadges = () => {
    storageService.getAgentContexts().then((ctxs) => {
      const badges: Record<string, boolean> = {};
      for (const [id, ctx] of Object.entries(ctxs)) {
        badges[id] = ctx.trim().length > 0;
      }
      setContextBadges(badges);
    });
  };

  useEffect(() => {
    if (!loadingAgents) refreshContextBadges();
  }, [loadingAgents]);

  useEffect(() => {
    if (!contextAgent) refreshContextBadges(); // Refresh when modal closes
  }, [contextAgent]);

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.expertise.some((e) => e.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDivision = !selectedDivision || agent.division === selectedDivision;
    return matchesSearch && matchesDivision;
  });

  const toggleAgent = (agent: Agent) => {
    setSelectedAgents((prev) =>
      prev.find((a) => a.id === agent.id)
        ? prev.filter((a) => a.id !== agent.id)
        : [...prev, agent]
    );
  };

  const handleCreateTeam = () => {
    if (selectedAgents.length > 0) {
      onTeamSelect(selectedAgents, teamName || `Team ${Date.now()}`);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-xl">
                🧠
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">YEOO <span className="text-purple-400">OS</span></h1>
                <p className="text-gray-400 text-sm mt-0.5">Agent Dashboard</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onProjectsClick}
              className="flex items-center gap-2 bg-[#1A1F2E] text-gray-400 border border-[#2D3548] px-4 py-2 rounded-xl hover:bg-[#2D3548] transition-all text-sm"
            >
              <FolderOpen size={16} />
              Projects
            </button>
            <button
              onClick={onChangeConfig}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              {provider === 'deepseek' ? '☁️ DeepSeek' : '🖥️ Ollama'} · {model} — Change
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-purple-400" />
              <span className="text-sm text-gray-400">Total Agents</span>
            </div>
          <p className="text-2xl font-bold text-white mt-1">{agents.length}</p>
          </div>
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-purple-400" />
              <span className="text-sm text-gray-400">Divisions</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">{YEOO_DIVISIONS.length}</p>
          </div>
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Check size={18} className="text-[#22C55E]" />
              <span className="text-sm text-gray-400">Selected</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">{selectedAgents.length}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search agents by name, skill, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111827] border border-[#1F2937] rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedDivision(null)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all text-sm ${
                selectedDivision === null
                  ? 'bg-purple-600 text-white'
                  : 'bg-[#1A1F2E] text-gray-400 border border-[#2D3548] hover:bg-[#2D3548]'
              }`}
            >
              All
            </button>
            {YEOO_DIVISIONS.map((division) => (
              <button
                key={division}
                onClick={() => setSelectedDivision(division)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all text-sm ${
                  selectedDivision === division
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#1A1F2E] text-gray-400 border border-[#2D3548] hover:bg-[#2D3548]'
                }`}
              >
                {division}
              </button>
            ))}
          </div>
        </div>

        {/* Agents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map((agent) => {
            const isSelected = selectedAgents.some((a) => a.id === agent.id);
            const hasContext = contextBadges[agent.id];
            return (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent)}
                className={`text-left bg-[#111827] border rounded-xl p-4 transition-all duration-200 hover:border-purple-500/50 ${
                  isSelected
                    ? 'border-purple-500 ring-1 ring-purple-500/30 bg-purple-500/5'
                    : 'border-[#1F2937]'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <img
                    src={avatarService.getAvatarUrl(agent.id, agent.gender, agent.firstName, agent.lastName)}
                    alt={agent.name}
                    className="w-10 h-10 rounded-lg object-cover border border-[#2D3548]"
                  />
                  {isSelected && (
                    <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-white text-sm">{agent.name}</h3>
                <p className="text-xs text-purple-400 mb-2">{agent.firstName} {agent.lastName} · {agent.division}</p>
                <p className="text-xs text-gray-400 line-clamp-2 mb-3">{agent.description}</p>
                <div className="flex gap-1 mb-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setContextAgent(agent); }}
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-all ${
                      hasContext
                        ? 'text-green-400 bg-green-500/10 border-green-500/30'
                        : 'bg-[#1A1F2E] text-gray-400 border-[#2D3548] hover:text-purple-400 hover:bg-purple-500/10'
                    }`}
                  >
                    <Settings2 size={10} />
                    Context{hasContext ? ' ✓' : ''}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {agent.expertise.slice(0, 3).map((skill) => (
                    <span
                      key={skill}
                      className="text-[10px] bg-[#1A1F2E] text-gray-400 px-2 py-0.5 rounded-full border border-[#2D3548]"
                    >
                      {skill}
                    </span>
                  ))}
                  {agent.expertise.length > 3 && (
                    <span className="text-[10px] text-gray-500">+{agent.expertise.length - 3}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Agent Context Modal */}
        {contextAgent && (
          <AgentContextModal
            agent={contextAgent}
            onClose={() => setContextAgent(null)}
            onSaved={() => {}}
          />
        )}

        {/* Create Team Bar */}
        {selectedAgents.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0A0A0A]/95 backdrop-blur-md border-t border-[#1F2937] z-40">
            <div className="max-w-7xl mx-auto flex items-center gap-4">
              <div className="flex-1 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-purple-400" />
                  <span className="text-white font-medium">{selectedAgents.length} agents selected</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedAgents.map((a) => (
                    <span
                      key={a.id}
                      className="text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded-lg border border-purple-500/20"
                    >
                      {a.emoji} {a.name}
                    </span>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team name (optional)"
                className="bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 w-48"
              />
              <button
                onClick={handleCreateTeam}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all"
              >
                Create Team
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};