import React, { useState, useEffect } from 'react';
import type { OrgAgent } from '../types';
import { X, Save, MessageSquare } from 'lucide-react';

interface ContextModalProps {
  agent: OrgAgent | null;
  onSave: (agentId: string, context: string) => void;
  onClose: () => void;
}

export const ContextModal: React.FC<ContextModalProps> = ({ agent, onSave, onClose }) => {
  const [context, setContext] = useState('');

  useEffect(() => {
    if (agent) {
      setContext(agent.context || '');
    }
  }, [agent]);

  if (!agent) return null;

  const handleSave = () => {
    onSave(agent.id, context);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827] border border-[#2D3548] rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1F2937]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#1A1F2E] border border-[#2D3548] flex items-center justify-center text-xl">
              {agent.emoji}
            </div>
            <div>
              <h3 className="font-bold text-white">{agent.name}</h3>
              <p className="text-sm text-red-400">{agent.role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <MessageSquare size={16} className="text-red-400" />
            <span>Custom Context for {agent.name}</span>
          </div>

          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={`Add specific instructions, preferences, or constraints for ${agent.name}...
            
Example:
"Use React 19. Prefer Material UI. Avoid Redux."
"Target Costa Rican small businesses."
"Focus on security-first architecture."`}
            rows={8}
            className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none text-sm"
            autoFocus
          />

          <p className="text-xs text-gray-500">
            This context will be injected into {agent.name}'s system prompt during execution.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            className="flex-1 bg-[#1A1F2E] hover:bg-[#2D3548] text-gray-400 font-medium py-2.5 px-4 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-900 600 hover:from-red-500 hover:to-red-900 500 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Save size={16} />
            Save Context
          </button>
        </div>
      </div>
    </div>
  );
};