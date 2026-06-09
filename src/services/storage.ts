import type { Agent } from '../types';

export interface SavedProject {
  id: string;
  name: string;
  createdAt: string;
  provider: string;
  model: string;
  agents: Agent[];
  messages: ChatMessage[];
  agentContexts: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentName?: string;
  timestamp: string;
}

class StorageService {
  private PROJECTS_KEY = 'yeoo_projects';
  private AGENT_CONTEXTS_KEY = 'yeoo_agent_contexts';

  // --- Projects ---

  getAllProjects(): SavedProject[] {
    try {
      const raw = localStorage.getItem(this.PROJECTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveProject(project: SavedProject): void {
    const projects = this.getAllProjects();
    const idx = projects.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      projects[idx] = project;
    } else {
      projects.push(project);
    }
    localStorage.setItem(this.PROJECTS_KEY, JSON.stringify(projects));
  }

  getProject(id: string): SavedProject | undefined {
    return this.getAllProjects().find(p => p.id === id);
  }

  deleteProject(id: string): void {
    const projects = this.getAllProjects().filter(p => p.id !== id);
    localStorage.setItem(this.PROJECTS_KEY, JSON.stringify(projects));
  }

  // --- Agent Contexts ---

  getAgentContexts(): Record<string, string> {
    try {
      const raw = localStorage.getItem(this.AGENT_CONTEXTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  saveAgentContext(agentId: string, context: string): void {
    const contexts = this.getAgentContexts();
    contexts[agentId] = context;
    localStorage.setItem(this.AGENT_CONTEXTS_KEY, JSON.stringify(contexts));
  }

  // --- CSV Export ---

  exportConversationToCSV(project: SavedProject): string {
    const headers = ['timestamp', 'role', 'agent', 'content'];
    const rows = project.messages.map(m => [
      m.timestamp,
      m.role,
      m.agentName || '',
      `"${m.content.replace(/"/g, '""')}"`,
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  downloadCSV(project: SavedProject): void {
    const csv = this.exportConversationToCSV(project);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_conversation.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportConversationToTXT(project: SavedProject): string {
    let txt = `=== YEOO OS Project: ${project.name} ===\n`;
    txt += `Created: ${project.createdAt}\n`;
    txt += `Provider: ${project.provider} | Model: ${project.model}\n`;
    txt += `Agents: ${project.agents.map(a => a.name).join(', ')}\n`;
    txt += `\n=== CONVERSATION ===\n\n`;

    for (const m of project.messages) {
      const agent = m.agentName ? `[${m.agentName}] ` : '';
      txt += `[${m.timestamp}] ${m.role.toUpperCase()}: ${agent}${m.content}\n\n`;
    }
    return txt;
  }

  downloadTXT(project: SavedProject): void {
    const txt = this.exportConversationToTXT(project);
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_conversation.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Context Export ---

  exportContextsToCSV(): string {
    const contexts = this.getAgentContexts();
    const headers = ['agent_id', 'context'];
    const rows = Object.entries(contexts).map(([id, ctx]) => [
      id,
      `"${ctx.replace(/"/g, '""')}"`,
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  downloadContextsCSV(): void {
    const csv = this.exportContextsToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agent_contexts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const storageService = new StorageService();