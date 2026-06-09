import axios from 'axios';

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
    try {
      const messages: DeepSeekMessage[] = [];
      if (options.system) {
        messages.push({ role: 'system', content: options.system });
      }
      messages.push({ role: 'user', content: options.prompt });

      const response = await axios.post(
        DEEPSEEK_API_URL,
        {
          model: options.model,
          messages,
          stream: false,
          temperature: options.temperature ?? 0.7,
          top_p: options.top_p ?? 0.9,
          max_tokens: options.max_tokens ?? 4096,
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
        if (error.response?.status === 401) {
          throw new Error('DeepSeek API key is invalid. Check your .env configuration.');
        }
        if (error.response?.status === 429) {
          throw new Error('DeepSeek rate limit exceeded. Please wait and try again.');
        }
        if (error.code === 'ECONNREFUSED' || !error.response) {
          throw new Error('Cannot connect to DeepSeek API. Check your internet connection.');
        }
        throw new Error(`DeepSeek API Error: ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<string> {
    try {
      const messages: DeepSeekMessage[] = [];
      if (options.system) {
        messages.push({ role: 'system', content: options.system });
      }
      messages.push({ role: 'user', content: options.prompt });

      const response = await axios.post(
        DEEPSEEK_API_URL,
        {
          model: options.model,
          messages,
          stream: true,
          temperature: options.temperature ?? 0.7,
          top_p: options.top_p ?? 0.9,
          max_tokens: options.max_tokens ?? 4096,
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
              if (delta) {
                yield delta;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('DeepSeek API key is invalid. Check your .env configuration.');
        }
        if (error.response?.status === 429) {
          throw new Error('DeepSeek rate limit exceeded. Please wait and try again.');
        }
        if (error.code === 'ECONNREFUSED' || !error.response) {
          throw new Error('Cannot connect to DeepSeek API. Check your internet connection.');
        }
        throw new Error(`DeepSeek API Error: ${error.message}`);
      }
      throw error;
    }
  }

  listModels(): string[] {
    // DeepSeek available models (cloud-based, always available)
    return [
      'deepseek-chat',
      'deepseek-reasoner',
    ];
  }
}

export default new DeepSeekService();