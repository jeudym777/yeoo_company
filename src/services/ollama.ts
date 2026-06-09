import axios from 'axios';
import type { OllamaResponse } from '../types';

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';

export interface GenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  top_k?: number;
}

class OllamaService {
  private client = axios.create({
    timeout: 120000, // 2 minutes for long responses
  });

  async generate(options: GenerateOptions): Promise<string> {
    try {
      const response = await this.client.post<OllamaResponse>(OLLAMA_API_URL, {
        model: options.model,
        prompt: options.prompt,
        system: options.system,
        stream: options.stream ?? false,
        temperature: options.temperature ?? 0.7,
        top_p: options.top_p ?? 0.9,
        top_k: options.top_k ?? 40,
      });

      return response.data.response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Cannot connect to Ollama. Make sure Ollama is running on localhost:11434');
        }
        throw new Error(`Ollama API Error: ${error.message}`);
      }
      throw error;
    }
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<string> {
    try {
      const response = await this.client.post(OLLAMA_API_URL, {
        model: options.model,
        prompt: options.prompt,
        system: options.system,
        stream: true,
        temperature: options.temperature ?? 0.7,
        top_p: options.top_p ?? 0.9,
        top_k: options.top_k ?? 40,
      }, {
        responseType: 'stream',
      });

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const json = JSON.parse(line);
              if (json.response) {
                yield json.response;
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Cannot connect to Ollama. Make sure Ollama is running on localhost:11434');
        }
        throw new Error(`Ollama API Error: ${error.message}`);
      }
      throw error;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.get('http://localhost:11434/api/tags');
      // Filter out embedding models, only return text generation models
      return response.data.models
        ?.filter((m: any) => {
          const name = m.name.toLowerCase();
          const family = m.details?.family?.toLowerCase() || '';
          // Exclude embedding models
          if (name.includes('embed') || family.includes('embed')) return false;
          if (name.includes('bge') || family.includes('bge')) return false;
          return true;
        })
        .map((m: any) => m.name) || [];
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  }
}

export default new OllamaService();
