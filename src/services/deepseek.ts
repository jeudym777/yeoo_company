const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
}

class DeepSeekService {
  private getApiKey(): string {
    const key = import.meta.env.VITE_DEEPSEEK_API_KEY;
    if (!key) {
      throw new Error('DeepSeek API key not configured. Add VITE_DEEPSEEK_API_KEY to your .env file.');
    }
    return key;
  }

  async generate(options: GenerateOptions): Promise<string> {
    const messages: DeepSeekMessage[] = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });

    try {
      const res = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          stream: false,
          temperature: options.temperature ?? 0.7,
          top_p: options.top_p ?? 0.9,
          max_tokens: options.max_tokens ?? 4096,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error('DeepSeek API key is invalid. Check your .env configuration.');
        if (res.status === 429) throw new Error('DeepSeek rate limit exceeded. Please wait and try again.');
        throw new Error(`DeepSeek API Error: ${errData?.error?.message || res.statusText}`);
      }

      const data = await res.json();
      return data.choices[0].message.content;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new Error('DeepSeek API request timed out.');
      }
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error('Cannot connect to DeepSeek API. Check your internet connection.');
      }
      throw err;
    }
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<string> {
    const messages: DeepSeekMessage[] = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });

    try {
      const res = await fetch(DEEPSEEK_API_URL, {
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
          top_p: options.top_p ?? 0.9,
          max_tokens: options.max_tokens ?? 4096,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!res.ok) throw new Error(`DeepSeek API Error: ${res.statusText}`);
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
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new Error('DeepSeek API request timed out.');
      }
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error('Cannot connect to DeepSeek API. Check your internet connection.');
      }
      throw err;
    }
  }

  listModels(): string[] {
    return ['deepseek-chat', 'deepseek-reasoner'];
  }
}

export default new DeepSeekService();