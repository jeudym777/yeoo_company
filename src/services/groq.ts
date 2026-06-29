const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface GenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
}

class GroqService {
  private getApiKey(): string {
    const key = import.meta.env.VITE_GROQ_API_KEY;
    if (!key) throw new Error('Groq API key not configured. Add VITE_GROQ_API_KEY to your .env file.');
    return key;
  }

  async generate(options: GenerateOptions): Promise<string> {
    const messages: { role: string; content: string }[] = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });

    try {
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          temperature: options.temperature ?? 0.7,
          top_p: options.top_p ?? 0.95,
          max_tokens: 4096,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('Groq API key is invalid. Check your key at console.groq.com.');
        if (res.status === 429) throw new Error('Groq rate limit exceeded (30 req/min). Wait and retry.');
        if (res.status === 404) throw new Error(`Groq model "${options.model}" not found. Available: llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768, gemma2-9b-it`);
        const errData = await res.json().catch(() => ({}));
        throw new Error(`Groq API Error: ${errData?.error?.message || res.statusText}`);
      }

      const data = await res.json();
      return data.choices[0].message.content;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error('Cannot reach Groq API (Network Error). Check your internet connection or try using Ollama (local) instead.');
      }
      throw err;
    }
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<string> {
    const messages: { role: string; content: string }[] = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });

    try {
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          stream: true,
          temperature: options.temperature ?? 0.7,
          top_p: options.top_p ?? 0.95,
          max_tokens: 4096,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!res.ok) throw new Error(`Groq API Error: ${res.statusText}`);
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
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') return;
            try {
              const json = JSON.parse(dataStr);
              const delta = json.choices[0]?.delta?.content;
              if (delta) yield delta;
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      if (err instanceof TypeError) throw new Error(`Groq API Error: ${err.message}`);
      throw err;
    }
  }

  listModels(): string[] {
    return [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ];
  }
}

export default new GroqService();