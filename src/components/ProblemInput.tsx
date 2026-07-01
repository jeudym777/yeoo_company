import React, { useState } from 'react';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';
import type { Provider } from '../types';

interface ProblemInputProps {
  provider: Provider;
  model: string;
  onGenerateOrg: (problem: string) => void;
  isGenerating: boolean;
  onChangeConfig: () => void;
}

export const ProblemInput: React.FC<ProblemInputProps> = ({
  provider,
  model,
  onGenerateOrg,
  isGenerating,
  onChangeConfig,
}) => {
  const [problem, setProblem] = useState('');

  const examples = [
    'I want to create a restaurant management platform.',
    'I need a marketing strategy for my AI company.',
    'I want to build a SaaS for lawyers.',
    'Design a crypto exchange platform.',
    'Create a telehealth application for hospitals.',
  ];

  const handleSubmit = () => {
    if (problem.trim() && !isGenerating) {
      onGenerateOrg(problem.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-red-900 600 flex items-center justify-center text-2xl">
              🧠
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white">
            YEOO <span className="text-red-400">OS</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            Describe your business problem and I'll build an AI organization to solve it.
          </p>
        </div>

        {/* Problem Input */}
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Sparkles size={16} className="text-red-400" />
            <span>What are we building today?</span>
          </div>

          <textarea
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="Describe your project, business idea, or problem in detail..."
            rows={5}
            className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none transition-all"
            disabled={isGenerating}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />

          {/* Examples */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Examples</p>
            <div className="flex flex-wrap gap-2">
              {examples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setProblem(ex)}
                  className="text-xs bg-[#0A0A0A] border border-[#1F2937] text-gray-400 px-3 py-1.5 rounded-lg hover:border-red-500 hover:text-red-300 transition-all"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={!problem.trim() || isGenerating}
              className="flex-1 bg-gradient-to-r from-red-600 to-red-900 600 hover:from-red-500 hover:to-red-900 500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all text-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Building Organization...
                </>
              ) : (
                <>
                  Generate AI Organization
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-600 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-[#0A0A0A] rounded border border-[#1F2937] text-gray-500">⌘</kbd> + <kbd className="px-1.5 py-0.5 bg-[#0A0A0A] rounded border border-[#1F2937] text-gray-500">Enter</kbd> to submit
          </p>
        </div>

        {/* Current Config */}
        <div className="text-center">
          <button
            onClick={onChangeConfig}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            {provider === 'deepseek' ? '☁️ DeepSeek' : '🖥️ Ollama'} · {model} — Change
          </button>
        </div>
      </div>
    </div>
  );
};