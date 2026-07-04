import React, { useState, useEffect } from 'react';
import type { Agent, Provider, OrgChart } from './types';
import type { SavedProject } from './services/storage';
import { ModelSelector } from './components/ModelSelector';
import { Dashboard } from './components/Dashboard';
import { TeamChat } from './components/TeamChat';
import { Projects } from './components/Projects';
import { ProblemInput } from './components/ProblemInput';
import { OrgChartView } from './components/OrgChartView';
import { ExecutionMonitor } from './components/ExecutionMonitor';
import { CEOServiceInstance } from './services/ceo';
import OllamaService from './services/ollama';
import DeepSeekService from './services/deepseek';
import GroqService from './services/groq';
import GeminiService from './services/gemini';

type View = 'model-config' | 'dashboard' | 'team-chat' | 'projects' | 'problem-input' | 'org-chart' | 'execution-monitor';

function App() {
  const [currentView, setCurrentView] = useState<View>('model-config');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<Provider>('ollama');
  const [teamAgents, setTeamAgents] = useState<Agent[]>([]);
  const [teamName, setTeamName] = useState('');
  const [activeProject, setActiveProject] = useState<SavedProject | undefined>();

  // AI Org Builder state
  const [activeOrgChart, setActiveOrgChart] = useState<OrgChart | undefined>();
  const [isGeneratingOrg, setIsGeneratingOrg] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  useEffect(() => {
    const savedModel = localStorage.getItem('selectedModel');
    const savedProvider = localStorage.getItem('selectedProvider') as Provider | null;
    if (savedModel) setSelectedModel(savedModel);
    if (savedProvider && ['ollama', 'deepseek', 'groq', 'gemini'].includes(savedProvider)) {
      setSelectedProvider(savedProvider);
    }
  }, []);

  // Fetch available models for provider
  useEffect(() => {
    const fetchModels = async () => {
      let models: string[] = [];
      try {
        if (selectedProvider === 'ollama') {
          models = await OllamaService.listModels();
        } else if (selectedProvider === 'deepseek') {
          models = DeepSeekService.listModels();
        } else if (selectedProvider === 'groq') {
          models = GroqService.listModels();
        } else if (selectedProvider === 'gemini') {
          models = GeminiService.listModels();
        }
      } catch (err) {
        console.error("Error loading models:", err);
      }
      setAvailableModels(models);
    };
    fetchModels();
  }, [selectedProvider]);

  // Removed auto-redirect so user can change model anytime

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('selectedModel', model);
    setCurrentView('dashboard');
  };

  const handleProviderChange = (provider: Provider) => {
    setSelectedProvider(provider);
    localStorage.setItem('selectedProvider', provider);
  };

  const handleTeamSelect = (agents: Agent[], name: string) => {
    setTeamAgents(agents);
    setTeamName(name);
    setActiveProject(undefined);
    setCurrentView('team-chat');
  };

  const handleOpenProject = (project: SavedProject) => {
    setTeamAgents(project.agents);
    setTeamName(project.name);
    setActiveProject(project);
    setCurrentView('team-chat');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setActiveProject(undefined);
  };

  const handleGoToProjects = () => {
    setCurrentView('projects');
  };

  const handleBackFromProjects = () => {
    setCurrentView('dashboard');
  };

  const handleGenerateOrg = async (problem: string) => {
    setIsGeneratingOrg(true);
    try {
      const orgChart = await CEOServiceInstance.generateOrganization({
        provider: selectedProvider,
        model: selectedModel,
        problem,
      });
      setActiveOrgChart(orgChart);
      setCurrentView('org-chart');
    } catch (error) {
      alert(`Error generating organization: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingOrg(false);
    }
  };

  return (
    <div className="yeoo-os">
      {currentView === 'model-config' && (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-2xl w-full">
            <ModelSelector
              selectedModel={selectedModel}
              selectedProvider={selectedProvider}
              onModelSelect={handleModelSelect}
              onProviderChange={handleProviderChange}
            />
          </div>
        </div>
      )}

      {currentView === 'dashboard' && (
        <Dashboard
          provider={selectedProvider}
          model={selectedModel}
          onTeamSelect={handleTeamSelect}
          onProjectsClick={handleGoToProjects}
          onChangeConfig={() => setCurrentView('model-config')}
          onOrgBuilderClick={() => setCurrentView('problem-input')}
        />
      )}

      {currentView === 'team-chat' && (
        <TeamChat
          agents={teamAgents}
          provider={selectedProvider}
          model={selectedModel}
          teamName={teamName}
          projectId={activeProject?.id}
          savedMessages={activeProject?.messages}
          onBack={handleBackToDashboard}
          onGoToProjects={handleGoToProjects}
        />
      )}

      {currentView === 'projects' && (
        <Projects
          provider={selectedProvider}
          model={selectedModel}
          onOpenProject={handleOpenProject}
          onBack={handleBackFromProjects}
        />
      )}

      {currentView === 'problem-input' && (
        <ProblemInput
          provider={selectedProvider}
          model={selectedModel}
          onGenerateOrg={handleGenerateOrg}
          isGenerating={isGeneratingOrg}
          onChangeConfig={() => setCurrentView('model-config')}
        />
      )}

      {currentView === 'org-chart' && activeOrgChart && (
        <OrgChartView
          orgChart={activeOrgChart}
          provider={selectedProvider}
          availableModels={availableModels}
          onUpdateAgents={(updatedAgents) => {
            setActiveOrgChart((prev) => prev ? { ...prev, agents: updatedAgents } : undefined);
          }}
          onLaunchExecution={() => setCurrentView('execution-monitor')}
          onBack={() => setCurrentView('dashboard')}
        />
      )}

      {currentView === 'execution-monitor' && activeOrgChart && (
        <ExecutionMonitor
          orgName={activeOrgChart.name}
          problem={activeOrgChart.problem}
          agents={activeOrgChart.agents}
          provider={selectedProvider}
          model={selectedModel}
          onBack={() => setCurrentView('org-chart')}
        />
      )}
    </div>
  );
}

export default App;