export type Provider = 'ollama' | 'deepseek';

export interface Agent {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  emoji: string;
  division: string;
  description: string;
  expertise: string[];
  deliverables: string[];
  prompt: string;
  avatarUrl?: string;
  gender?: 'male' | 'female';
}

export interface OrgAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description: string;
  parentId: string | null;
  model: string;
  context: string;
  skills: string[];
  status: 'active' | 'inactive' | 'pending';
  prompt: string;
  division: string;
  avatarUrl?: string;
  gender?: 'male' | 'female';
}

export interface OrgChart {
  id: string;
  name: string;
  problem: string;
  agents: OrgAgent[];
  createdAt: Date;
  provider: Provider;
}

export interface ExecutionNode {
  agentId: string;
  agentName: string;
  emoji: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number; // 0-100
  input: string;
  output: string;
  error?: string;
}

export interface ExecutionResult {
  nodes: ExecutionNode[];
  finalReport: string;
  status: 'idle' | 'running' | 'completed' | 'error';
}

export interface Team {
  id: string;
  name: string;
  agents: Agent[];
  createdAt: Date;
  description: string;
}

export interface OllamaMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface OllamaResponse {
  response: string;
  done: boolean;
  model: string;
  created_at: string;
}