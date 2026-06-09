import React, { useState, useEffect } from 'react';
import type { Agent, Provider } from './types';
import type { SavedProject } from './services/storage';
import { ModelSelector } from './components/ModelSelector';
import { Dashboard } from './components/Dashboard';
import { TeamChat } from './components/TeamChat';
import { Projects } from './components/Projects';
import OllamaService from './services/ollama';
import DeepSeekService from './services/deepseek';

type View = 'model-config' | 'dashboard' | 'team-chat' | 'projects';

function App() {
  const [currentView, setCurrentView] = useState<View>('model-config');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<Provider>('ollama');
  const [teamAgents, setTeamAgents] = useState<Agent[]>([]);
  const [teamName, setTeamName] = useState('');
  const [activeProject, setActiveProject] = useState<SavedProject | undefined>();

  useEffect(() => {
    const savedModel = localStorage.getItem('selectedModel');
    const savedProvider = localStorage.getItem('selectedProvider') as Provider | null;
    if (savedModel) setSelectedModel(savedModel);
    if (savedProvider && (savedProvider === 'ollama' || savedProvider === 'deepseek')) {
      setSelectedProvider(savedProvider);
    }
  }, []);

  // Auto-skip to dashboard if model is configured
  useEffect(() => {
    if (selectedModel && currentView === 'model-config') {
      setCurrentView('dashboard');
    }
  }, [selectedModel, currentView]);

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
    </div>
  );
}

export default App;