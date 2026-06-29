const OLLAMA_API_URL = 'http://localhost:11434/api';

export interface GenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
}

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

class OllamaService {
  private async post(path: string, body: any): Promise<any> {
    try {
      const res = await fetch(`${OLLAMA_API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300000),
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error('Ollama model not found. Pull it first: ollama pull <model>');
        throw new Error(`Ollama API Error (${res.status}): ${res.statusText}`);
      }

      return res.json();
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error('Cannot connect to Ollama. Make sure it is running on localhost:11434');
      }
      throw err;
    }
  }

  async generate(options: GenerateOptions): Promise<string> {
    const { model, prompt, system, temperature } = options;
    const fullPrompt = system
      ? `[SYSTEM]\n${system}\n\n[USER]\n${prompt}`
      : prompt;

    const data = await this.post('/generate', {
      model,
      prompt: fullPrompt,
      stream: false,
      options: {
        temperature: temperature ?? 0.7,
        top_p: options.top_p ?? 0.9,
      },
    });

    return data.response || '';
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<string> {
    const { model, prompt, system, temperature } = options;
    const fullPrompt = system
      ? `[SYSTEM]\n${system}\n\n[USER]\n${prompt}`
      : prompt;

    const res = await fetch(`${OLLAMA_API_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: fullPrompt,
        stream: true,
        options: {
          temperature: temperature ?? 0.7,
          top_p: options.top_p ?? 0.9,
        },
      }),
      signal: AbortSignal.timeout(300000),
    });

    if (!res.ok) throw new Error(`Ollama API Error: ${res.statusText}`);
    if (!res.body) throw new Error('No response body for stream');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.response) yield json.response;
          if (json.done) return;
        } catch { /* skip */ }
      }
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${OLLAMA_API_URL}/tags`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m: any) => m.name);
    } catch {
      return [];
    }
  }

  async getModelInfo(model: string): Promise<OllamaModel | null> {
    try {
      const res = await fetch(`${OLLAMA_API_URL}/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return null;
      const data = await res.json();
      return {
        name: model,
        modified_at: data.modified_at || '',
        size: data.size || 0,
        digest: data.digest || '',
      };
    } catch {
      return null;
    }
  }
}

export default new OllamaService();