import axios from 'axios';

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
    try {
      const modelId = options.model || 'gemini-2.0-flash';
      const url = `${GEMINI_BASE_URL}/models/${modelId}:generateContent?key=${this.getApiKey()}`;

      const contents: any[] = [];
      const systemInstruction = options.system
        ? { parts: [{ text: options.system }] }
        : undefined;

      contents.push({
        role: 'user',
        parts: [{ text: options.prompt }],
      });

      const payload: any = {
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          topP: options.top_p ?? 0.95,
          maxOutputTokens: 4096,
        },
      };

      if (systemInstruction) {
        payload.systemInstruction = systemInstruction;
      }

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000,
      });

      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new Error(
            'Cannot reach Gemini (Network Error). The browser may be blocking the request. Try using Groq or Ollama instead.'
          );
        }
        const status = error.response?.status;
        const msg = error.response?.data?.error?.message || '';
        if (status === 400) {
          if (msg.includes('API_KEY_INVALID')) throw new Error('Gemini API key is invalid. Get a new one at aistudio.google.com.');
          if (msg.includes('not found') || msg.includes('models/')) throw new Error(`Gemini model "${options.model}" not found. Use gemini-1.5-flash or gemini-1.5-pro.`);
          throw new Error(`Gemini API Error (400): ${msg}`);
        }
        if (status === 403) throw new Error('Gemini API key lacks permission. Enable "Generative Language API" at console.cloud.google.com.');
        if (status === 429) throw new Error('Gemini rate limit (429). This API key may have reached its quota. Try Ollama (local, unlimited) or Groq (14,400 req/day).');
        throw new Error(`Gemini API Error (${status}): ${msg || error.message}`);
      }
      throw error;
    }
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<string> {
    try {
      const modelId = options.model || 'gemini-2.0-flash';
      const url = `${GEMINI_BASE_URL}/models/${modelId}:streamGenerateContent?alt=sse&key=${this.getApiKey()}`;

      const contents: any[] = [];
      const systemInstruction = options.system
        ? { parts: [{ text: options.system }] }
        : undefined;

      contents.push({ role: 'user', parts: [{ text: options.prompt }] });

      const payload: any = {
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          topP: options.top_p ?? 0.95,
          maxOutputTokens: 4096,
        },
      };

      if (systemInstruction) payload.systemInstruction = systemInstruction;

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000,
        responseType: 'stream',
      });

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) yield text;
            } catch { /* skip */ }
          }
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) throw new Error(`Gemini API Error: ${error.message}`);
      throw error;
    }
  }

  listModels(): string[] {
    return [
      'gemini-2.0-flash',
    ];
  }
}

export default new GeminiService();