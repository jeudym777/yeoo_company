import React, { useState, useEffect } from 'react';
import { Settings, RefreshCw, Zap, Cloud, Server } from 'lucide-react';
import type { Provider } from '../types';
import OllamaService from '../services/ollama';
import DeepSeekService from '../services/deepseek';

interface ModelSelectorProps {
  selectedModel: string;
  selectedProvider: Provider;
  onModelSelect: (model: string) => void;
  onProviderChange: (provider: Provider) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  selectedProvider,
  onModelSelect,
  onProviderChange,
}) => {
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [deepseekModels, setDeepseekModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, [selectedProvider]);

  const loadModels = async () => {
    setIsLoading(true);
    setError(null);

    if (selectedProvider === 'ollama') {
      try {
        const availableModels = await OllamaService.listModels();
        if (availableModels.length > 0) {
          setOllamaModels(availableModels);
          if (!selectedModel || !availableModels.includes(selectedModel)) {
            onModelSelect(availableModels[0]);
          }
        } else {
          setError(
            'No se encontraron modelos de Ollama. Asegúrate de tener Ollama ejecutándose y modelos descargados.'
          );
        }
      } catch {
        setError(
          'No se puede conectar a Ollama. Asegúrate de que está ejecutándose en localhost:11434'
        );
      }
    } else {
      // DeepSeek - cloud models always available
      const models = DeepSeekService.listModels();
      setDeepseekModels(models);
      if (!selectedModel || !models.includes(selectedModel)) {
        onModelSelect(models[0]);
      }
    }

    setIsLoading(false);
  };

  const currentModels = selectedProvider === 'ollama' ? ollamaModels : deepseekModels;

  const handleProviderChange = (provider: Provider) => {
    onProviderChange(provider);
    // Auto-select default model for the new provider
    if (provider === 'deepseek') {
      onModelSelect('deepseek-chat');
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Settings size={24} className="text-indigo-600" />
        <h2 className="text-xl font-bold text-gray-900">Configuración de Modelo</h2>
      </div>

      {/* Provider Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Proveedor de IA
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleProviderChange('ollama')}
            className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
              selectedProvider === 'ollama'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <Server size={20} />
            <div className="text-left">
              <p className="font-semibold text-sm">Ollama</p>
              <p className="text-xs opacity-70">Local</p>
            </div>
            {selectedProvider === 'ollama' && (
              <Zap size={16} className="ml-auto text-indigo-500" />
            )}
          </button>

          <button
            onClick={() => handleProviderChange('deepseek')}
            className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
              selectedProvider === 'deepseek'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <Cloud size={20} />
            <div className="text-left">
              <p className="font-semibold text-sm">DeepSeek</p>
              <p className="text-xs opacity-70">Cloud API</p>
            </div>
            {selectedProvider === 'deepseek' && (
              <Zap size={16} className="ml-auto text-indigo-500" />
            )}
          </button>
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
          Detectando modelos disponibles...
        </div>
      ) : currentModels.length > 0 ? (
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            Modelo {selectedProvider === 'ollama' ? 'Ollama' : 'DeepSeek'}
          </label>
          <select
            value={selectedModel}
            onChange={(e) => onModelSelect(e.target.value)}
            className="input-field"
          >
            <option value="">Selecciona un modelo</option>
            {currentModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          {selectedProvider === 'ollama' && (
            <p className="text-xs text-gray-600">
              Modelos recomendados: mistral, neural-chat, llama2
            </p>
          )}
          {selectedProvider === 'deepseek' && (
            <p className="text-xs text-gray-600">
              deepseek-chat: modelo general | deepseek-reasoner: razonamiento avanzado
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-600 mb-3">No hay modelos disponibles</p>
          <button
            onClick={loadModels}
            className="btn-secondary flex items-center gap-2 mx-auto"
          >
            <RefreshCw size={16} />
            Reintentar
          </button>
        </div>
      )}

      {selectedProvider === 'ollama' && (
        <div className="pt-4 border-t border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-2">Instrucciones para Ollama</h3>
          <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>Instala Ollama desde ollama.ai</li>
            <li>Ejecuta: <code className="bg-gray-100 px-1 rounded">ollama serve</code></li>
            <li>En otra terminal, descarga un modelo: <code className="bg-gray-100 px-1 rounded">ollama pull mistral</code></li>
            <li>¡Recarga esta página y comenzaremos!</li>
          </ol>
        </div>
      )}
    </div>
  );
};