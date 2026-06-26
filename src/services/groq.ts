import axios from 'axios';

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
    try {
      const messages: { role: string; content: string }[] = [];
      if (options.system) messages.push({ role: 'system', content: options.system });
      messages.push({ role: 'user', content: options.prompt });

      const response = await axios.post(
        GROQ_API_URL,
        {
          model: options.model,
          messages,
          temperature: options.temperature ?? 0.7,
          top_p: options.top_p ?? 0.95,
          max_tokens: 4096,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.getApiKey()}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new Error(
            'Cannot reach Groq API (Network Error). This may be a CORS issue in the browser or your network is blocking it. Try using Ollama (local) instead.'
          );
        }
        if (error.response?.status === 401) throw new Error('Groq API key is invalid. Check your key at console.groq.com.');
        if (error.response?.status === 429) throw new Error('Groq rate limit exceeded (30 req/min). Wait and retry.');
        if (error.response?.status === 404) throw new Error(`Groq model "${options.model}" not found. Available: llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768, gemma2-9b-it`);
        throw new Error(`Groq API Error: ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<string> {
    try {
      const messages: { role: string; content: string }[] = [];
      if (options.system) messages.push({ role: 'system', content: options.system });
      messages.push({ role: 'user', content: options.prompt });

      const response = await axios.post(
        GROQ_API_URL,
        {
          model: options.model,
          messages,
          stream: true,
          temperature: options.temperature ?? 0.7,
          top_p: options.top_p ?? 0.95,
          max_tokens: 4096,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.getApiKey()}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
          responseType: 'stream',
        }
      );

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') return;
            try {
              const json = JSON.parse(data);
              const delta = json.choices[0]?.delta?.content;
              if (delta) yield delta;
            } catch { /* skip */ }
          }
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) throw new Error(`Groq API Error: ${error.message}`);
      throw error;
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