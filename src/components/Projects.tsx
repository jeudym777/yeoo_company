import React, { useState, useEffect } from 'react';
import type { Agent, Provider } from '../types';
import type { SavedProject, ChatMessage } from '../services/storage';
import { storageService } from '../services/storage';
import { ArrowLeft, Trash2, Download, MessageSquare, Calendar, Users, Cpu, FolderOpen } from 'lucide-react';

interface ProjectsProps {
  provider: Provider;
  model: string;
  onOpenProject: (project: SavedProject) => void;
  onBack: () => void;
}

export const Projects: React.FC<ProjectsProps> = ({ provider, model, onOpenProject, onBack }) => {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    storageService.getAllProjects().then(setProjects);
  }, []);

  const handleDelete = async (id: string) => {
    await storageService.deleteProject(id);
    const updated = await storageService.getAllProjects();
    setProjects(updated);
    setDeleteConfirm(null);
  };

  const handleDownloadCSV = (project: SavedProject) => {
    storageService.downloadCSV(project);
  };

  const handleDownloadTXT = (project: SavedProject) => {
    storageService.downloadTXT(project);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#1F2937] rounded-lg transition-colors">
              <ArrowLeft size={18} className="text-gray-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">Projects</h1>
              <p className="text-gray-400 text-sm mt-0.5">Saved conversations and team configurations</p>
            </div>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20">
            <FolderOpen size={60} className="mx-auto text-gray-600 mb-4" />
            <h2 className="text-xl font-bold text-gray-400 mb-2">No projects yet</h2>
            <p className="text-gray-500">Create a team and start a conversation to save your first project.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 hover:border-red-500/30 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => onOpenProject(project)}
                        className="text-lg font-bold text-white hover:text-red-400 transition-colors"
                      >
                        {project.name}
                      </button>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare size={12} />
                        {project.messages.length} messages
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {project.agents.length} agents
                      </span>
                      <span className="flex items-center gap-1">
                        <Cpu size={12} />
                        {project.provider} · {project.model}
                      </span>
                    </div>

                    {/* Agents */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {project.agents.map((a) => (
                        <span
                          key={a.id}
                          className="text-[10px] bg-[#1A1F2E] text-gray-400 px-2 py-0.5 rounded-full border border-[#2D3548]"
                        >
                          {a.emoji} {a.name}
                        </span>
                      ))}
                    </div>

                    {/* Last message preview */}
                    {project.messages.length > 0 && (
                      <p className="text-xs text-gray-600 truncate">
                        Last: {project.messages[project.messages.length - 1].content.substring(0, 120)}...
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                    <button
                      onClick={() => onOpenProject(project)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-[#1F2937] rounded-lg transition-all"
                      title="Open"
                    >
                      <MessageSquare size={16} />
                    </button>
                    <button
                      onClick={() => handleDownloadCSV(project)}
                      className="p-2 text-gray-400 hover:text-[#22C55E] hover:bg-[#1F2937] rounded-lg transition-all"
                      title="Download CSV"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => handleDownloadTXT(project)}
                      className="p-2 text-gray-400 hover:text-blue-400 hover:bg-[#1F2937] rounded-lg transition-all"
                      title="Download TXT"
                    >
                      <span className="text-xs font-bold">.txt</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(project.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-[#1F2937] rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111827] border border-[#2D3548] rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-bold text-lg mb-2">Delete Project?</h3>
            <p className="text-gray-400 text-sm mb-4">
              This project and all its conversations will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-[#1A1F2E] text-gray-400 py-2 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 py-2 rounded-xl"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};