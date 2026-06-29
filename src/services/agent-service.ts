import { supabase } from './supabase';
import { YEOO_AGENTS } from '../agents_yeoo';
import type { Agent } from '../types';

const AGENTS_SYNCED_KEY = 'yeoo_agents_synced';

class AgentService {
  private cachedAgents: Agent[] | null = null;

  /**
   * Seed default agents from agents_yeoo.ts into Supabase (one-time operation)
   */
  async seedDefaultAgents(): Promise<void> {
    const alreadySynced = localStorage.getItem(AGENTS_SYNCED_KEY);
    if (alreadySynced) return;

    try {
      // Check if agents table has data
      const { count } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true });

      if (count && count > 0) {
        localStorage.setItem(AGENTS_SYNCED_KEY, 'true');
        return;
      }

      // Insert all default agents
      const rows = YEOO_AGENTS.map((agent) => ({
        id: agent.id,
        name: agent.name,
        first_name: agent.firstName,
        last_name: agent.lastName,
        emoji: agent.emoji,
        division: agent.division,
        description: agent.description,
        expertise: agent.expertise,
        deliverables: agent.deliverables,
        prompt: agent.prompt,
        avatar_url: agent.avatarUrl || '',
        gender: agent.gender || null,
        context: '',
      }));

      const { error } = await supabase.from('agents').upsert(rows, { onConflict: 'id' });
      if (!error) {
        localStorage.setItem(AGENTS_SYNCED_KEY, 'true');
      }
    } catch {
      // Supabase unavailable — keep using local agents
    }
  }

  /**
   * Get all agents from Supabase, falling back to agents_yeoo.ts
   */
  async getAllAgents(): Promise<Agent[]> {
    if (this.cachedAgents) return this.cachedAgents;

    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('id', { ascending: true });

      if (!error && data && data.length > 0) {
        this.cachedAgents = data.map((row: any) => ({
          id: row.id,
          name: row.name,
          firstName: row.first_name || '',
          lastName: row.last_name || '',
          emoji: row.emoji || '🤖',
          division: row.division || '',
          description: row.description || '',
          expertise: row.expertise || [],
          deliverables: row.deliverables || [],
          prompt: row.prompt || '',
          avatarUrl: row.avatar_url || '',
          gender: row.gender || undefined,
        }));
        return this.cachedAgents;
      }
    } catch {}

    // Fallback to local agents
    this.cachedAgents = YEOO_AGENTS;
    return this.cachedAgents;
  }

  /**
   * Get a single agent by ID
   */
  async getAgent(id: string): Promise<Agent | undefined> {
    const agents = await this.getAllAgents();
    return agents.find((a) => a.id === id);
  }

  /**
   * Update an agent's context/knowledge (stored in agent_contexts table)
   */
  async saveAgentContext(agentId: string, context: string): Promise<void> {
    try {
      await supabase.from('agent_contexts').upsert({
        agent_id: agentId,
        context,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Fallback to localStorage
      try {
        const key = `agent_context_${agentId}`;
        localStorage.setItem(key, context);
      } catch {}
    }
  }

  /**
   * Get an agent's custom context
   */
  async getAgentContext(agentId: string): Promise<string> {
    try {
      const { data } = await supabase
        .from('agent_contexts')
        .select('context')
        .eq('agent_id', agentId)
        .maybeSingle();

      if (data?.context) return data.context;
    } catch {}

    // Fallback to localStorage
    try {
      return localStorage.getItem(`agent_context_${agentId}`) || '';
    } catch {
      return '';
    }
  }

  /**
   * Update an agent's prompt in Supabase (extends their knowledge)
   */
  async extendAgentKnowledge(agentId: string, additionalKnowledge: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) return;

    const currentContext = await this.getAgentContext(agentId);
    const newContext = currentContext
      ? `${currentContext}\n\n${additionalKnowledge}`
      : additionalKnowledge;

    await this.saveAgentContext(agentId, newContext);

    // Update local cache
    if (this.cachedAgents) {
      const idx = this.cachedAgents.findIndex((a) => a.id === agentId);
      if (idx >= 0) {
        this.cachedAgents[idx] = {
          ...this.cachedAgents[idx],
          prompt: `${this.cachedAgents[idx].prompt}\n\nCUSTOM KNOWLEDGE:\n${newContext}`,
        };
      }
    }
  }

  /**
   * Clear agents cache (forces reload from Supabase)
   */
  clearCache(): void {
    this.cachedAgents = null;
  }

  /**
   * Reset sync flag (forces re-seed on next load)
   */
  resetSyncFlag(): void {
    localStorage.removeItem(AGENTS_SYNCED_KEY);
    this.cachedAgents = null;
  }
}

export const agentService = new AgentService();