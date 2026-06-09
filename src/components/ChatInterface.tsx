import React, { useState, useRef, useEffect } from 'react';
import type { Agent, Provider } from '../types';
import OllamaService from '../services/ollama';
import DeepSeekService from '../services/deepseek';
import { Send, ArrowLeft, Loader } from 'lucide-react';

interface ChatInterfaceProps {
  agents: Agent[];
  onBack: () => void;
  model: string;
  provider: Provider;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentName?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ agents, onBack, model, provider }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    agents.length > 0 ? agents[0].id : null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedAgent || isLoading || !model) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setConnectionError(null);

    try {
      const systemPrompt = selectedAgent.prompt;
      let response: string;

      if (provider === 'ollama') {
        response = await OllamaService.generate({
          model,
          prompt: inputValue,
          system: systemPrompt,
          temperature: 0.7,
        });
      } else {
        response = await DeepSeekService.generate({
          model,
          prompt: inputValue,
          system: systemPrompt,
          temperature: 0.7,
        });
      }

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response,
        agentName: selectedAgent.name,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      setConnectionError(errorMessage);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `❌ Error: ${errorMessage}`,
          agentName: 'Sistema',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Equipo de Agentes</h1>
          <p className="text-sm text-gray-600">
            {agents.length} agentes disponibles
          </p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Agents */}
        <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4 space-y-2">
            <h2 className="font-bold text-gray-900 mb-4">Agentes Disponibles</h2>
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedAgentId === agent.id
                    ? 'bg-indigo-100 border-2 border-indigo-500 text-indigo-900'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{agent.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{agent.name}</p>
                    <p className="text-xs text-gray-600 truncate">
                      {agent.division}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Model Info */}
          <div className="bg-indigo-50 border-b border-indigo-200 px-6 py-3 text-sm text-indigo-800">
            <strong>Proveedor:</strong> {provider === 'deepseek' ? '☁️ DeepSeek' : '🖥️ Ollama'} |{' '}
            <strong>Modelo:</strong> {model} | <strong>Agente Activo:</strong>{' '}
            {selectedAgent ? `${selectedAgent.emoji} ${selectedAgent.name}` : 'Ninguno'}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-gray-600 mb-2">
                    {selectedAgent ? (
                      <>
                        ¡Hola! Soy {selectedAgent.emoji} <strong>{selectedAgent.name}</strong>
                      </>
                    ) : (
                      'Selecciona un agente para comenzar'
                    )}
                  </p>
                  {selectedAgent && (
                    <p className="text-sm text-gray-500">
                      {selectedAgent.description}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-2xl px-4 py-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-gray-200 text-gray-900 rounded-bl-none'
                    }`}
                  >
                    {message.role === 'assistant' && message.agentName && (
                      <p className="text-xs font-semibold mb-1 opacity-75">
                        {message.agentName}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 text-gray-900 px-4 py-3 rounded-lg flex items-center gap-2">
                  <Loader size={16} className="animate-spin" />
                  <span className="text-sm">
                    {selectedAgent?.name} está pensando...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 bg-white p-6">
            {connectionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {connectionError}
              </div>
            )}
            <div className="flex gap-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Escribe tu pregunta..."
                className="input-field flex-1"
                disabled={isLoading || !selectedAgent}
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !selectedAgent || !inputValue.trim()}
                className={`p-3 rounded-lg transition-colors ${
                  isLoading || !selectedAgent || !inputValue.trim()
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'btn-primary'
                }`}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};