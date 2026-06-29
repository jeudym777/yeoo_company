import type { Provider } from '../types';
import OllamaService from './ollama';
import DeepSeekService from './deepseek';

interface GenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
}

/**
 * Routes a generate request to the correct provider service.
 * Uses dynamic imports for Groq & Gemini to avoid bundling issues.
 */
export async function generateWithProvider(
  provider: Provider,
  options: GenerateOptions
): Promise<string> {
  const { model, prompt, system, temperature } = options;

  switch (provider) {
    case 'ollama':
      return await OllamaService.generate({ model, prompt, system, temperature });

    case 'deepseek':
      return await DeepSeekService.generate({ model, prompt, system, temperature });

    case 'groq': {
      const { default: GroqService } = await import('./groq');
      return await GroqService.generate({ model, prompt, system, temperature });
    }

    case 'gemini': {
      const { default: GeminiService } = await import('./gemini');
      return await GeminiService.generate({ model, prompt, system, temperature });
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}