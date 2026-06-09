import type { Agent, OrgAgent } from '../types';

// Generic fallback avatars
import botmale1 from '../CARASBOTS/botmale1.jpg';
import botmale2 from '../CARASBOTS/botmale2.jpg';
import botmale3 from '../CARASBOTS/botmale3.jpg';
import botmale4 from '../CARASBOTS/botmale4.jpg';
import botfemale from '../CARASBOTS/botfemale.jpg';
import botfemale1 from '../CARASBOTS/botfemale1.jpg';
import botfemale2 from '../CARASBOTS/botfemale2.jpg';
import botfemale3 from '../CARASBOTS/botfemale3.jpg';

// Dynamic import of ALL images in CARASBOTS folder
// Vite automatically processes this at build time
const imageModules = import.meta.glob('../CARASBOTS/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' });

// Build a lookup map: filename (without ext) → URL
const NAMED_MAP: Record<string, string> = {};

for (const [path, url] of Object.entries(imageModules)) {
  // Extract filename without extension: '../CARASBOTS/alejandrocastillo.jpg' → 'alejandrocastillo'
  const filename = path.split('/').pop()!.split('.')[0]!.toLowerCase();
  NAMED_MAP[filename] = url as string;
}

const MALE_AVATARS = [botmale1, botmale2, botmale3, botmale4];
const FEMALE_AVATARS = [botfemale, botfemale1, botfemale2, botfemale3];

/**
 * Normalize a name for filename matching:
 * "Alejandro Castillo" → "alejandrocastillo"
 */
function normalizeName(firstName: string, lastName: string): string {
  return `${firstName}${lastName}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .replace(/[^a-z]/g, '');         // remove non-letters
}

class AvatarService {
  private assignmentMap = new Map<string, string>();

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Get the avatar URL for an agent.
   * Priority:
   *   1) Named photo matching firstname+lastname (e.g., alejandrocastillo.jpg)
   *   2) Generic pool by gender (botmale*, botfemale*)
   */
  getAvatarUrl(agentId: string, gender?: 'male' | 'female', firstName?: string, lastName?: string): string {
    // If already assigned, return cached
    if (this.assignmentMap.has(agentId)) {
      return this.assignmentMap.get(agentId)!;
    }

    // Try named photo first
    if (firstName && lastName) {
      const baseName = normalizeName(firstName, lastName);
      if (NAMED_MAP[baseName]) {
        this.assignmentMap.set(agentId, NAMED_MAP[baseName]);
        return NAMED_MAP[baseName];
      }
    }

    // Fall back to generic pool
    const pool = gender === 'female' ? FEMALE_AVATARS : MALE_AVATARS;
    const hash = this.hashString(agentId);
    const url = pool[hash % pool.length];
    this.assignmentMap.set(agentId, url);
    return url;
  }

  assignAvatarToAgent(agent: Agent): Agent {
    if (agent.avatarUrl && agent.avatarUrl !== '') return agent;
    const avatarUrl = this.getAvatarUrl(agent.id, agent.gender, agent.firstName, agent.lastName);
    return { ...agent, avatarUrl };
  }

  assignAvatarsToAgents(agents: Agent[]): Agent[] {
    return agents.map(a => this.assignAvatarToAgent(a));
  }

  assignAvatarToOrgAgent(agent: OrgAgent): OrgAgent {
    if (agent.avatarUrl && agent.avatarUrl !== '') return agent;
    const avatarUrl = this.getAvatarUrl(agent.id, agent.gender);
    return { ...agent, avatarUrl };
  }

  assignAllAvatars(agents: OrgAgent[]): OrgAgent[] {
    return agents.map(a => this.assignAvatarToOrgAgent(a));
  }
}

export const avatarService = new AvatarService();