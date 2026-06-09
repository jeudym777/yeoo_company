import React from 'react';
import type { Agent } from '../types';
import { Check } from 'lucide-react';

interface AgentCardProps {
  agent: Agent;
  isSelected: boolean;
  onSelect: (agent: Agent) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, isSelected, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(agent)}
      className={`card p-4 cursor-pointer transition-all duration-200 ${
        isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50' : 'hover:ring-2 hover:ring-indigo-300'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-3xl">{agent.emoji}</span>
        {isSelected && <Check className="text-indigo-600" size={20} />}
      </div>
      <h3 className="font-bold text-gray-900 mb-1">{agent.name}</h3>
      <p className="text-xs text-gray-600 mb-3">{agent.description}</p>
      <div className="flex flex-wrap gap-1">
        {agent.expertise.slice(0, 3).map((skill) => (
          <span key={skill} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
            {skill}
          </span>
        ))}
        {agent.expertise.length > 3 && (
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
            +{agent.expertise.length - 3}
          </span>
        )}
      </div>
    </div>
  );
};
