// Use Vite proxy in dev, direct URL in production
const GEMINI_BASE_URL = import.meta.env.DEV ? '/api/gemini' : 'https://generativelanguage.googleapis.com/v1beta';

export interface GenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
}

class GeminiService {
  private getApiKey(): string {
    const key = import.meta.env.VITE_GEMINI_API_KEY;
    if (!key) throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.');
    return key;
  }

  async generate(options: GenerateOptions): Promise<string> {
    const modelId = options.model || 'gemini-2.0-flash';
    const url = `${GEMINI_BASE_URL}/models/${modelId}:generateContent?key=${this.getApiKey()}`;

    const payload: any = {
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        topP: options.top_p ?? 0.95,
        maxOutputTokens: 4096,
      },
    };

    if (options.system) {
      payload.systemInstruction = { parts: [{ text: options.system }] };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120000),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData?.error?.message || '';
        const status = res.status;

        if (!res) throw new Error('Cannot reach Gemini (Network Error). The browser may be blocking the request. Try using Groq or Ollama instead.');
        if (status === 400) {
          if (msg.includes('API_KEY_INVALID')) throw new Error('Gemini API key is invalid. Get a new one at aistudio.google.com.');
          if (msg.includes('not found') || msg.includes('models/')) throw new Error(`Gemini model "${options.model}" not found. Use gemini-1.5-flash or gemini-1.5-pro.`);
          throw new Error(`Gemini API Error (400): ${msg}`);
        }
        if (status === 403) throw new Error('Gemini API key lacks permission. Enable "Generative Language API" at console.cloud.google.com.');
        if (status === 429) throw new Error('Gemini rate limit (429). This API key may have reached its quota. Try Ollama (local, unlimited) or Groq (14,400 req/day).');
        throw new Error(`Gemini API Error (${status}): ${msg || res.statusText}`);
      }

      const data = await res.json();
      return data.candidates[0].content.parts[0].text;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error('Cannot reach Gemini (Network Error). The browser may be blocking the request. Try using Groq or Ollama instead.');
      }
      throw err;
    }
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<string> {
    const modelId = options.model || 'gemini-2.0-flash';
    const url = `${GEMINI_BASE_URL}/models/${modelId}:streamGenerateContent?alt=sse&key=${this.getApiKey()}`;

    const payload: any = {
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        topP: options.top_p ?? 0.95,
        maxOutputTokens: 4096,
      },
    };

    if (options.system) payload.systemInstruction = { parts: [{ text: options.system }] };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120000),
      });

      if (!res.ok) throw new Error(`Gemini API Error: ${res.statusText}`);
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
            if (!dataStr || dataStr === '[DONE]') continue;
            try {
              const json = JSON.parse(dataStr);
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) yield text;
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      if (err instanceof TypeError) throw new Error(`Gemini API Error: ${err.message}`);
      throw err;
    }
  }

  listModels(): string[] {
    return ['gemini-2.0-flash'];
  }
}

export default new GeminiService();