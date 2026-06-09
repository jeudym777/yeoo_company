import React, { useState } from 'react';
import type { Agent, Provider } from '../types';
import OllamaService from '../services/ollama';
import DeepSeekService from '../services/deepseek';
import { OrchestratorPDFGenerator } from './OrchestratorPDFGenerator';
import { ArrowLeft, Loader } from 'lucide-react';

interface AgentFlowExecutorProps {
  agents: Agent[];
  model: string;
  provider: Provider;
  wordLimit: number;
  onBack: () => void;
}

interface AgentResult {
  agent: Agent;
  input: string;
  output: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export const AgentFlowExecutor: React.FC<AgentFlowExecutorProps> = ({
  agents,
  model,
  provider,
  wordLimit,
  onBack,
}) => {
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [agentResults, setAgentResults] = useState<AgentResult[]>([]);
  const [orchestratorResult, setOrchestratorResult] = useState<AgentResult | null>(null);

  const callGenerate = async (prompt: string, system: string): Promise<string> => {
    if (provider === 'ollama') {
      return await OllamaService.generate({
        model,
        prompt,
        system,
        temperature: 0.7,
      });
    } else {
      return await DeepSeekService.generate({
        model,
        prompt,
        system,
        temperature: 0.7,
      });
    }
  };

  const executeAgentFlow = async () => {
    if (!userInput.trim()) return;

    setIsProcessing(true);
    setAgentResults([]);
    setOrchestratorResult(null);

    // Initialize results tracking
    const results: AgentResult[] = agents.map((agent) => ({
      agent,
      input: '',
      output: '',
      status: 'pending',
    }));

    setAgentResults(results);

    let currentContext = userInput;
    let lastAgentIndex = 0;

    try {
      // Execute each agent sequentially
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];

        // Update status to processing
        results[i].status = 'processing';
        results[i].input = currentContext;
        setAgentResults([...results]);

        try {
          const systemPrompt = `${agent.prompt}

IMPORTANT CONSTRAINTS:
- Keep response under ${wordLimit} words
- Be concise and focused
- Provide clear analysis or recommendations`;

          const response = await callGenerate(currentContext, systemPrompt);

          // Truncate response if needed
          const words = response.split(/\s+/);
          const truncatedResponse = words.slice(0, wordLimit).join(' ');
          const wasTruncated = words.length > wordLimit;

          results[i].output = truncatedResponse + (wasTruncated ? '\n[... truncated to word limit]' : '');
          results[i].status = 'completed';

          // Pass output as context for next agent, PLUS original prompt for alignment
          if (i < agents.length - 1) {
            currentContext = `ORIGINAL USER QUERY:\n${userInput}\n\nPREVIOUS ANALYSIS:\nFrom ${agent.name}:\n${results[i].output}\n\nNow please analyze from your perspective and align with the original query.`;
          }
          lastAgentIndex = i;
        } catch (error) {
          results[i].output = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          results[i].status = 'error';
        }

        setAgentResults([...results]);
      }

      // Execute Orchestrator (Discussion Agent) - "Agents Orchestrator"
      const orchestratorAgent = {
        id: 'orchestrator',
        name: 'Agents Orchestrator',
        firstName: 'Agents',
        lastName: 'Orchestrator',
        emoji: '🎭',
        division: 'Specialized',
        description: 'Discusses and integrates analysis from all agents',
        expertise: ['Coordination', 'Synthesis'],
        deliverables: ['Final Report'],
        prompt: 'You are the Agents Orchestrator. Review all the previous analyses and discussions. Determine if the integration of all the reasoning makes sense. If any information needs adjustment or clarification, provide the refined analysis. Give a final comprehensive response that synthesizes all perspectives.',
      };

      const orchestratorContext = `ORIGINAL USER QUERY:\n${userInput}\n\n---INDIVIDUAL AGENT ANALYSES---\n\n${results
        .map((r) => `${r.agent.name}:\n${r.output}`)
        .join('\n\n---\n\n')}\n\n---SYNTHESIS REQUESTED---\nBased on the original query and all agent analyses above, please provide a final integrated analysis and conclusion.`;

      const orchestratorSystemPrompt = `${orchestratorAgent.prompt}

IMPORTANT CONSTRAINTS:
- Keep response under ${wordLimit * 2} words (2x limit for comprehensive summary)
- Synthesize all previous analyses
- Identify consensus and divergence
- Provide clear final recommendations aligned with the original query`;

      const orchestratorResponse = await callGenerate(orchestratorContext, orchestratorSystemPrompt);

      const orchestratorWords = orchestratorResponse.split(/\s+/);
      const truncatedOrchestrator = orchestratorWords.slice(0, wordLimit * 2).join(' ');
      const orchestratorTruncated = orchestratorWords.length > wordLimit * 2;

      setOrchestratorResult({
        agent: orchestratorAgent,
        input: orchestratorContext,
        output: truncatedOrchestrator + (orchestratorTruncated ? '\n[... truncated to word limit]' : ''),
        status: 'completed',
      });
    } catch (error) {
      console.error('Flow execution error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAsPDF = async () => {
    if (!orchestratorResult) return;
    // PDF download is now handled by OrchestratorPDFGenerator component
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
          <h1 className="text-2xl font-bold text-gray-900">Agent Analysis Flow</h1>
          <p className="text-sm text-gray-600">
            {agents.length} agentes en cadena | {provider === 'deepseek' ? '☁️ DeepSeek' : '🖥️ Ollama'} - {model}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Input Section */}
        {agentResults.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <label className="block text-lg font-semibold text-gray-900">
              ¿Cuál es tu pregunta o desafío?
            </label>
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Describe el problema, pregunta o análisis que necesitas..."
              rows={6}
              className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isProcessing}
            />
            <button
              onClick={executeAgentFlow}
              disabled={!userInput.trim() || isProcessing}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {isProcessing ? (
                <>
                  <Loader size={20} className="animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  ▶ Iniciar Análisis en Cadena
                </>
              )}
            </button>
          </div>
        )}

        {/* Results Section */}
        {(agentResults.length > 0 || orchestratorResult) && (
          <div className="space-y-6">
            {/* Agent Results */}
            {agentResults.map((result, index) => (
              <div
                key={result.agent.id}
                className="bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-500"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{result.agent.emoji}</span>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">
                      {index + 1}. {result.agent.name}
                    </h3>
                    <p className="text-sm text-gray-600">{result.agent.description}</p>
                  </div>
                  {result.status === 'processing' && <Loader size={20} className="animate-spin text-indigo-600" />}
                  {result.status === 'completed' && <span className="text-green-600 text-2xl">✓</span>}
                  {result.status === 'error' && <span className="text-red-600 text-2xl">✗</span>}
                </div>

                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Contexto recibido:</h4>
                    <div className="bg-gray-50 p-3 rounded text-sm text-gray-600 max-h-24 overflow-y-auto">
                      {result.input}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Análisis:</h4>
                    <div className="bg-blue-50 p-4 rounded text-sm text-gray-800 whitespace-pre-wrap">
                      {result.output}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Orchestrator Result */}
            {orchestratorResult && (
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{orchestratorResult.agent.emoji}</span>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{orchestratorResult.agent.name}</h3>
                    <p className="text-sm text-gray-600">Discussion & Integration</p>
                  </div>
                  {orchestratorResult.status === 'completed' && <span className="text-green-600 text-2xl">✓</span>}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Conclusión Final:</h4>
                  <div className="bg-purple-50 p-4 rounded text-sm text-gray-800 whitespace-pre-wrap">
                    {orchestratorResult.output}
                  </div>
                </div>
              </div>
            )}

            {/* Download Button */}
            {!isProcessing && orchestratorResult && (
              <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 rounded-lg shadow-lg">
                <OrchestratorPDFGenerator
                  orchestratorResult={orchestratorResult}
                  agentResults={agentResults}
                  userInput={userInput}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};