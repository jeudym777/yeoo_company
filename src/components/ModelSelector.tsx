import React, { useState, useEffect } from 'react';
import { Settings, RefreshCw, Zap, Cloud, Server, Cpu, Globe } from 'lucide-react';
import type { Provider } from '../types';
import OllamaService from '../services/ollama';
import DeepSeekService from '../services/deepseek';
import GroqService from '../services/groq';
import GeminiService from '../services/gemini';

interface ModelSelectorProps {
  selectedModel: string;
  selectedProvider: Provider;
  onModelSelect: (model: string) => void;
  onProviderChange: (provider: Provider) => void;
}

type ProviderInfo = {
  key: Provider;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
};

const PROVIDERS: ProviderInfo[] = [
  { key: 'ollama', label: 'Ollama', subtitle: 'Local GPU', icon: <Server size={20} />, color: 'indigo' },
  { key: 'deepseek', label: 'DeepSeek', subtitle: 'Cloud API', icon: <Cloud size={20} />, color: 'blue' },
  { key: 'groq', label: 'Groq', subtitle: 'Fast & Free', icon: <Cpu size={20} />, color: 'emerald' },
  { key: 'gemini', label: 'Gemini', subtitle: 'Google Free', icon: <Globe size={20} />, color: 'amber' },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  selectedProvider,
  onModelSelect,
  onProviderChange,
}) => {
  const [cachedModels, setCachedModels] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, [selectedProvider]);

  const loadModels = async () => {
    setIsLoading(true);
    setError(null);

    if (cachedModels[selectedProvider]) {
      setIsLoading(false);
      return;
    }

    if (selectedProvider === 'ollama') {
      try {
        const models = await OllamaService.listModels();
        if (models.length > 0) {
          setCachedModels((prev) => ({ ...prev, ollama: models }));
          if (!selectedModel || !models.includes(selectedModel)) onModelSelect(models[0]);
        } else {
          setError('No Ollama models found. Make sure Ollama is running and models are downloaded.');
        }
      } catch {
        setError('Cannot connect to Ollama. Ensure it is running on localhost:11434');
      }
    } else if (selectedProvider === 'deepseek') {
      const models = DeepSeekService.listModels();
      setCachedModels((prev) => ({ ...prev, deepseek: models }));
      if (!selectedModel || !models.includes(selectedModel)) onModelSelect(models[0]);
    } else if (selectedProvider === 'groq') {
      const models = GroqService.listModels();
      setCachedModels((prev) => ({ ...prev, groq: models }));
      if (!selectedModel || !models.includes(selectedModel)) onModelSelect(models[0]);
    } else if (selectedProvider === 'gemini') {
      const models = GeminiService.listModels();
      setCachedModels((prev) => ({ ...prev, gemini: models }));
      if (!selectedModel || !models.includes(selectedModel)) onModelSelect(models[0]);
    }

    setIsLoading(false);
  };

  const currentModels = cachedModels[selectedProvider] || [];

  const handleProviderChange = (provider: Provider) => {
    onProviderChange(provider);
  };

  const providerColors: Record<string, string> = {
    indigo: 'border-indigo-500 bg-indigo-50 text-indigo-700',
    blue: 'border-blue-500 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-500 bg-amber-50 text-amber-700',
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Settings size={24} className="text-indigo-600" />
        <h2 className="text-xl font-bold text-gray-900">Model Configuration</h2>
      </div>

      {/* Provider Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          AI Provider
        </label>
        <div className="grid grid-cols-2 gap-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.key}
              onClick={() => handleProviderChange(p.key)}
              className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                selectedProvider === p.key
                  ? providerColors[p.color]
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {p.icon}
              <div className="text-left">
                <p className="font-semibold text-sm">{p.label}</p>
                <p className="text-xs opacity-70">{p.subtitle}</p>
              </div>
              {selectedProvider === p.key && (
                <Zap size={16} className="ml-auto text-current opacity-50" />
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-600">
          <RefreshCw size={16} className="animate-spin" />
          Detecting available models...
        </div>
      ) : currentModels.length > 0 ? (
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            Model — {PROVIDERS.find((p) => p.key === selectedProvider)?.label}
          </label>
          <select
            value={selectedModel}
            onChange={(e) => onModelSelect(e.target.value)}
            className="input-field"
          >
            <option value="">Select a model</option>
            {currentModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          {selectedProvider === 'ollama' && (
            <p className="text-xs text-gray-600">Recommended: mistral, llama3.1, gemma2</p>
          )}
          {selectedProvider === 'deepseek' && (
            <p className="text-xs text-gray-600">deepseek-chat: general | deepseek-reasoner: advanced reasoning</p>
          )}
          {selectedProvider === 'groq' && (
            <p className="text-xs text-gray-600">⚡ Fastest inference. Free tier: 30 req/min, 14,400 req/day</p>
          )}
          {selectedProvider === 'gemini' && (
            <p className="text-xs text-gray-600">🌐 Google AI. Free tier: 1,500 req/day</p>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-600 mb-3">No models available</p>
          <button
            onClick={loadModels}
            className="btn-secondary flex items-center gap-2 mx-auto"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      {selectedProvider === 'ollama' && (
        <div className="pt-4 border-t border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-2">Ollama Instructions</h3>
          <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>Install Ollama from ollama.ai</li>
            <li>Run: <code className="bg-gray-100 px-1 rounded">ollama serve</code></li>
            <li>Download a model: <code className="bg-gray-100 px-1 rounded">ollama pull mistral</code></li>
            <li>Reload this page!</li>
          </ol>
        </div>
      )}
    </div>
  );
};