import React, { useState } from 'react';
import type { OrgAgent, Provider } from '../types';
import { Edit3, Trash2, MessageSquare, Cpu, MoreVertical, Check, X } from 'lucide-react';

interface AgentCardV2Props {
  agent: OrgAgent;
  provider: Provider;
  availableModels: string[];
  onEdit: (id: string, updates: Partial<OrgAgent>) => void;
  onRemove: (id: string) => void;
  onContext: (id: string) => void;
  onChangeModel: (id: string, model: string) => void;
}

export const AgentCardV2: React.FC<AgentCardV2Props> = ({
  agent,
  provider,
  availableModels,
  onEdit,
  onRemove,
  onContext,
  onChangeModel,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [editName, setEditName] = useState(agent.name);
  const [editRole, setEditRole] = useState(agent.role);

  const handleSaveEdit = () => {
    onEdit(agent.id, { name: editName, role: editRole });
    setIsEditing(false);
  };

  const statusColors: Record<string, string> = {
    active: 'bg-[#22C55E]',
    inactive: 'bg-gray-500',
    pending: 'bg-yellow-500',
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 w-72 hover:border-red-500/50 transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {agent.avatarUrl ? (
            <img
              src={agent.avatarUrl}
              alt={agent.name}
              className="w-10 h-10 rounded-lg border border-[#2D3548] object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`w-10 h-10 rounded-lg bg-[#1A1F2E] border border-[#2D3548] flex items-center justify-center text-xl ${agent.avatarUrl ? 'hidden' : ''}`}>
            {agent.emoji}
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${statusColors[agent.status]}`} />
            <span className="text-xs text-gray-500 uppercase">
              {agent.status}
            </span>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowModelMenu(!showModelMenu)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <MoreVertical size={16} />
          </button>

          {showModelMenu && (
            <div className="absolute right-0 top-6 bg-[#1A1F2E] border border-[#2D3548] rounded-lg p-1 z-50 min-w-[150px]">
              {availableModels.map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    onChangeModel(agent.id, m);
                    setShowModelMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded hover:bg-[#2D3548] transition-colors ${
                    agent.model === m ? 'text-red-400' : 'text-gray-400'
                  }`}
                >
                  <Cpu size={12} className="inline mr-1" />
                  {m}
                  {agent.model === m && <Check size={12} className="inline ml-1" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Name & Role */}
      {isEditing ? (
        <div className="space-y-2 mb-3">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-[#2D3548] rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-red-500"
            autoFocus
          />
          <input
            value={editRole}
            onChange={(e) => setEditRole(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-[#2D3548] rounded-lg px-2 py-1 text-gray-300 text-xs focus:outline-none focus:border-red-500"
          />
          <div className="flex gap-1">
            <button onClick={handleSaveEdit} className="text-[#22C55E] hover:text-green-400 p-1">
              <Check size={14} />
            </button>
            <button onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-gray-300 p-1">
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <h3 className="font-bold text-white text-sm">{agent.name}</h3>
          <p className="text-xs text-red-400">{agent.role}</p>
        </div>
      )}

      {/* Description */}
      <p className="text-xs text-gray-400 mb-3 line-clamp-2">{agent.description}</p>

      {/* Model */}
      <div className="flex items-center gap-1.5 mb-3">
        <Cpu size={12} className="text-gray-500" />
        <span className="text-xs text-gray-500">{agent.model}</span>
      </div>

      {/* Skills */}
      <div className="flex flex-wrap gap-1 mb-3">
        {agent.skills.slice(0, 4).map((skill) => (
          <span
            key={skill}
            className="text-[10px] bg-[#1A1F2E] text-gray-400 px-2 py-0.5 rounded-full border border-[#2D3548]"
          >
            {skill}
          </span>
        ))}
      </div>

      {/* Context Badge */}
      {agent.context && (
        <div className="mb-3">
          <div className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded-lg border border-red-500/20 truncate">
            📝 {agent.context.substring(0, 40)}{agent.context.length > 40 ? '...' : ''}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1 pt-2 border-t border-[#1F2937] opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setIsEditing(true)}
          className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-white hover:bg-[#1F2937] rounded-lg py-1.5 transition-all"
          title="Edit"
        >
          <Edit3 size={12} />
          Edit
        </button>
        <button
          onClick={() => onContext(agent.id)}
          className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-red-400 hover:bg-[#1F2937] rounded-lg py-1.5 transition-all"
          title="Context"
        >
          <MessageSquare size={12} />
          Context
        </button>
        <button
          onClick={() => onRemove(agent.id)}
          className="flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-red-400 hover:bg-[#1F2937] rounded-lg py-1.5 px-2 transition-all"
          title="Remove"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};