import { supabase } from './supabase';
import type { Agent, Provider } from '../types';

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
  // --- Projects ---

  async getAllProjects(): Promise<SavedProject[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, messages(*)')
      .order('created_at', { ascending: false });

    if (error || !data) {
      // Fallback to localStorage if Supabase is unavailable
      return this.getAllProjectsLocal();
    }

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      provider: row.provider,
      model: row.model,
      agents: typeof row.agents_json === 'string' ? JSON.parse(row.agents_json) : row.agents_json,
      messages: (row.messages || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        agentName: m.agent_name,
        timestamp: m.timestamp,
      })),
      agentContexts: {},
    }));
  }

  async saveProject(project: SavedProject): Promise<void> {
    // Save project
    const { error: projErr } = await supabase
      .from('projects')
      .upsert({
        id: project.id,
        name: project.name,
        provider: project.provider,
        model: project.model,
        agents_json: project.agents,
        updated_at: new Date().toISOString(),
      });

    if (projErr) {
      // Fallback to localStorage
      this.saveProjectLocal(project);
      return;
    }

    // Delete old messages and insert new ones
    await supabase.from('messages').delete().eq('project_id', project.id);

    if (project.messages.length > 0) {
      const messagesRows = project.messages.map((m) => ({
        id: m.id,
        project_id: project.id,
        role: m.role,
        agent_name: m.agentName || null,
        content: m.content,
        timestamp: m.timestamp,
      }));

      const { error: msgErr } = await supabase.from('messages').upsert(messagesRows);
      if (msgErr) this.saveProjectLocal(project);
    }
  }

  getProject(id: string): Promise<SavedProject | undefined> {
    return this.getAllProjects().then((p) => p.find((p) => p.id === id));
  }

  async deleteProject(id: string): Promise<void> {
    await supabase.from('messages').delete().eq('project_id', id);
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) this.deleteProjectLocal(id);
  }

  // --- Agent Contexts ---

  async getAgentContexts(): Promise<Record<string, string>> {
    const { data, error } = await supabase.from('agent_contexts').select('*');
    if (error || !data) return this.getAgentContextsLocal();

    const contexts: Record<string, string> = {};
    for (const row of data) {
      contexts[row.agent_id] = row.context;
    }
    return contexts;
  }

  async saveAgentContext(agentId: string, context: string): Promise<void> {
    const { error } = await supabase
      .from('agent_contexts')
      .upsert({
        agent_id: agentId,
        context,
        updated_at: new Date().toISOString(),
      });

    if (error) this.saveAgentContextLocal(agentId, context);
  }

  // --- Fallback methods (localStorage) ---
  private PROJECTS_KEY = 'yeoo_projects';
  private AGENT_CONTEXTS_KEY = 'yeoo_agent_contexts';

  private getAllProjectsLocal(): SavedProject[] {
    try { return JSON.parse(localStorage.getItem(this.PROJECTS_KEY) || '[]'); } catch { return []; }
  }
  private saveProjectLocal(project: SavedProject): void {
    const projects = this.getAllProjectsLocal();
    const idx = projects.findIndex((p) => p.id === project.id);
    if (idx >= 0) projects[idx] = project; else projects.push(project);
    localStorage.setItem(this.PROJECTS_KEY, JSON.stringify(projects));
  }
  private deleteProjectLocal(id: string): void {
    const projects = this.getAllProjectsLocal().filter((p) => p.id !== id);
    localStorage.setItem(this.PROJECTS_KEY, JSON.stringify(projects));
  }
  private getAgentContextsLocal(): Record<string, string> {
    try { return JSON.parse(localStorage.getItem(this.AGENT_CONTEXTS_KEY) || '{}'); } catch { return {}; }
  }
  private saveAgentContextLocal(agentId: string, context: string): void {
    const contexts = this.getAgentContextsLocal();
    contexts[agentId] = context;
    localStorage.setItem(this.AGENT_CONTEXTS_KEY, JSON.stringify(contexts));
  }

  // --- CSV/TXT Export ---

  exportConversationToCSV(project: SavedProject): string {
    const headers = ['timestamp', 'role', 'agent', 'content'];
    const rows = project.messages.map((m) => [
      m.timestamp, m.role, m.agentName || '', `"${m.content.replace(/"/g, '""')}"`,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  downloadCSV(project: SavedProject): void {
    const blob = new Blob([this.exportConversationToCSV(project)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${project.name.replace(/\s+/g, '_')}_conversation.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  exportConversationToTXT(project: SavedProject): string {
    let txt = `=== YEOO OS Project: ${project.name} ===\nCreated: ${project.createdAt}\nProvider: ${project.provider} | Model: ${project.model}\nAgents: ${project.agents.map((a) => a.name).join(', ')}\n\n=== CONVERSATION ===\n\n`;
    for (const m of project.messages) {
      txt += `[${m.timestamp}] ${m.role.toUpperCase()}: ${m.agentName ? `[${m.agentName}] ` : ''}${m.content}\n\n`;
    }
    return txt;
  }

  downloadTXT(project: SavedProject): void {
    const blob = new Blob([this.exportConversationToTXT(project)], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${project.name.replace(/\s+/g, '_')}_conversation.txt`;
    a.click(); URL.revokeObjectURL(url);
  }
}

export const storageService = new StorageService();