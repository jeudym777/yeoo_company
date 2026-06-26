import React, { useState, useEffect, useRef } from 'react';
import type { Agent } from '../types';
import { storageService } from '../services/storage';
import { avatarService } from '../services/avatar';
import { X, Save, Trash2, Upload, FileText, MessageSquare } from 'lucide-react';

interface AgentContextModalProps {
  agent: Agent | null;
  onClose: () => void;
  onSaved: () => void;
}

export const AgentContextModal: React.FC<AgentContextModalProps> = ({ agent, onClose, onSaved }) => {
  const [context, setContext] = useState('');
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (agent) {
      storageService.getAgentContexts().then((contexts) => {
        const saved = contexts[agent.id] || '';
        setContext(saved);

        const fileMarker = saved.match(/\[ATTACHED_FILE:\s*(.+?)\]/);
        if (fileMarker) {
          setAttachmentName(fileMarker[1]);
        } else {
          setAttachmentName(null);
        }
      });
    }
  }, [agent]);

  if (!agent) return null;

  const handleSave = () => {
    if (!agent) return;

    let finalContext = context;

    // If there's an attachment, append it to context
    if (attachmentName && !context.includes('[ATTACHED_FILE:')) {
      finalContext = context + (context ? '\n\n' : '') + `[ATTACHED_FILE: ${attachmentName}]`;
    }

    storageService.saveAgentContext(agent.id, finalContext);
    onSaved();
    onClose();
  };

  const handleDelete = () => {
    if (!agent) return;
    storageService.saveAgentContext(agent.id, '');
    setContext('');
    setAttachmentName(null);
    onSaved();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Only accept .txt files
    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
      alert('Only .txt files are supported for context.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setAttachmentName(file.name);

      // Append the file content as context
      setContext((prev) => {
        const base = prev.replace(/\[ATTACHED_FILE:.*?\]\n?/g, '').trim();
        return (
          base +
          (base ? '\n\n' : '') +
          `[ATTACHED_FILE: ${file.name}]\n--- File Content ---\n${content}\n--- End File ---`
        );
      });
    };
    reader.readAsText(file);
  };

  const characterCount = context.length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827] border border-[#2D3548] rounded-2xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1F2937]">
          <div className="flex items-center gap-3">
            <img
              src={avatarService.getAvatarUrl(agent.id, agent.gender, agent.firstName, agent.lastName)}
              alt={agent.name}
              className="w-12 h-12 rounded-lg object-cover border border-[#2D3548]"
            />
            <div>
              <h3 className="font-bold text-white text-lg">{agent.firstName} {agent.lastName}</h3>
              <p className="text-sm text-purple-400">{agent.division} · {agent.name.split(' ').slice(-1)[0] !== agent.lastName ? agent.name : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <MessageSquare size={16} className="text-purple-400" />
            <span>General Context for {agent.firstName} {agent.lastName}</span>
          </div>

          {/* Text Area */}
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={`Add custom instructions, knowledge, preferences, or constraints for ${agent.firstName}...

Example:
"Use React 19 with Server Components. Prefer Tailwind CSS. Target enterprise clients in Mexico City."
"Focus on mobile-first design. Use Spanish language for all responses."
"Specialize in financial sector regulations for LATAM."`}
            rows={10}
            className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none text-sm font-mono"
            autoFocus
          />

          {/* File Upload + Character Count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Upload .txt button */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-[#1A1F2E] text-gray-400 border border-[#2D3548] px-3 py-1.5 rounded-lg hover:bg-[#2D3548] transition-all text-xs"
              >
                <Upload size={14} />
                Attach .txt
              </button>

              {attachmentName && (
                <span className="flex items-center gap-1 text-xs text-[#22C55E] bg-[#22C55E]/10 px-2 py-1 rounded-lg border border-[#22C55E]/20">
                  <FileText size={12} />
                  {attachmentName}
                </span>
              )}
            </div>

            <span className="text-xs text-gray-500">{characterCount} characters</span>
          </div>

          <p className="text-xs text-gray-500">
            This context is injected into {agent.firstName}'s system prompt during every conversation. 
            You can also attach .txt files with additional knowledge.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-medium py-2.5 px-4 rounded-xl transition-colors text-sm"
          >
            <Trash2 size={14} />
            Clear Context
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-[#1A1F2E] hover:bg-[#2D3548] text-gray-400 font-medium py-2.5 px-4 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Save size={16} />
            Save Context
          </button>
        </div>
      </div>
    </div>
  );
};