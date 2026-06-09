import React, { useState } from 'react';
import { AGENTS_ALL, DIVISIONS_ALL, getAgentsByDivision } from '../agents_all';
import type { Agent } from '../types';
import { AgentCard } from './AgentCard';
import { Search, Filter } from 'lucide-react';

interface AgentSelectorProps {
  onTeamSelect: (agents: Agent[]) => void;
}

export const AgentSelector: React.FC<AgentSelectorProps> = ({ onTeamSelect }) => {
  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);

  const filteredAgents = AGENTS_ALL.filter((agent) => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDivision = !selectedDivision || agent.division === selectedDivision;
    return matchesSearch && matchesDivision;
  });

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgents((prev) => {
      const isAlreadySelected = prev.find((a) => a.id === agent.id);
      if (isAlreadySelected) {
        return prev.filter((a) => a.id !== agent.id);
      } else {
        return [...prev, agent];
      }
    });
  };

  const handleCreateTeam = () => {
    if (selectedAgents.length > 0) {
      onTeamSelect(selectedAgents);
    }
  };

  const isAgentSelected = (agentId: string) => {
    return selectedAgents.some((a) => a.id === agentId);
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Busca agentes por nombre o especialidad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        {/* Division Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Filter size={18} className="text-gray-600 flex-shrink-0" />
          <button
            onClick={() => setSelectedDivision(null)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              selectedDivision === null
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Todas
          </button>
          {DIVISIONS_ALL.map((division) => (
            <button
              key={division}
              onClick={() => setSelectedDivision(division)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                selectedDivision === division
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {division}
            </button>
          ))}
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isSelected={isAgentSelected(agent.id)}
            onSelect={handleSelectAgent}
          />
        ))}
      </div>

      {/* Selected Agents Summary and Action */}
      {selectedAgents.length > 0 && (
        <div className="card p-6 space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 mb-3">
              Equipo seleccionado ({selectedAgents.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {selectedAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-indigo-100 text-indigo-800 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between"
                >
                  <span>{agent.emoji} {agent.name}</span>
                  <button
                    onClick={() => handleSelectAgent(agent)}
                    className="ml-2 hover:text-indigo-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button onClick={handleCreateTeam} className="btn-primary w-full">
            Crear Equipo 🚀
          </button>
        </div>
      )}
    </div>
  );
};
