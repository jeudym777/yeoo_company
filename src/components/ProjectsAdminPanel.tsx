import React, { useState, useEffect } from 'react';
import { projectService, type Proyecto, type ProyectoTarea } from '../services/project-service';
import { prospectService } from '../services/prospect-service';
import { agentService } from '../services/agent-service';
import { generateWithProvider } from '../services/provider-router';
import type { Agent, Provider } from '../types';
import { X, Search, Briefcase, Plus, Trash2, Loader2, Save, FileText, Edit2, FolderOpen, ClipboardList, BookOpen, Clock, CheckSquare, Square, Users, Cpu, ArrowRight, UserCheck } from 'lucide-react';

interface ProjectsAdminPanelProps {
  provider: Provider;
  model: string;
  onClose: () => void;
}

const NUEVO_PROYECTO = (): Proyecto => ({
  id: `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: '',
  client_name: '',
  status: 'planificacion',
  budget: '',
  deadline: '',
  description: '',
  assigned_agents: [],
  memory_bank: '',
  weekly_report: {
    completed: '',
    next_steps: '',
    blockers: ''
  }
});

export const ProjectsAdminPanel: React.FC<ProjectsAdminPanelProps> = ({
  provider,
  model,
  onClose
}) => {
  const [projects, setProjects] = useState<Proyecto[]>([]);
  const [clients, setClients] = useState<string[]>([]); // Client names from CRM (status = aceptado)
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'planificacion' | 'desarrollo' | 'pruebas_qa' | 'entregado'>('todos');

  // Selected Project & Tasks
  const [selectedProject, setSelectedProject] = useState<Proyecto | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'tasks' | 'memory' | 'report'>('details');
  const [tasks, setTasks] = useState<ProyectoTarea[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // New task inputs per stage
  const [newTaskTitles, setNewTaskTitles] = useState<Record<string, string>>({
    planificacion: '',
    desarrollo: '',
    pruebas_qa: '',
    entregado: ''
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load projects
      const pList = await projectService.getProjects();
      setProjects(pList);

      // 2. Load accepted prospects as clients
      const prospects = await prospectService.getAll();
      const acceptedClients = prospects
        .filter(pr => pr.status === 'aceptado')
        .map(pr => pr.company_name);
      setClients(acceptedClients);

      // 3. Load agents
      const agents = await agentService.getAllAgents();
      setAllAgents(agents);
    } catch (e) {
      setError('Error al conectar con Supabase. Ejecuta la migración SQL de proyectos.');
    } finally {
      setLoading(false);
    }
  };

  const selectProject = async (proj: Proyecto) => {
    setSelectedProject(proj);
    setIsEditing(false);
    setActiveTab('details');
    
    // Load tasks for this project
    setLoadingTasks(true);
    try {
      const tList = await projectService.getTasks(proj.id);
      setTasks(tList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !selectedProject.name.trim()) return;

    setSaving(true);
    try {
      await projectService.saveProject(selectedProject);
      setIsEditing(false);
      await loadAllData();
      // Keep selected
      const updated = projects.find(p => p.id === selectedProject.id) || selectedProject;
      setSelectedProject({ ...updated });
    } catch (err) {
      alert('Error al guardar el proyecto.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este proyecto y todas sus tareas de forma permanente?')) return;
    try {
      await projectService.deleteProject(id);
      setSelectedProject(null);
      await loadAllData();
    } catch (e) {
      alert('Error al eliminar proyecto');
    }
  };

  // Agent assignment toggle
  const toggleAgentAssignment = (agentId: string) => {
    if (!selectedProject) return;
    const currentList = selectedProject.assigned_agents;
    const newList = currentList.includes(agentId)
      ? currentList.filter(id => id !== agentId)
      : [...currentList, agentId];
    
    setSelectedProject({ ...selectedProject, assigned_agents: newList });
  };

  // Task Actions
  const handleAddTask = async (stage: ProyectoTarea['stage']) => {
    const title = newTaskTitles[stage]?.trim();
    if (!title || !selectedProject) return;

    const newTask: ProyectoTarea = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      project_id: selectedProject.id,
      title,
      stage,
      assigned_agent_id: null,
      completed: false
    };

    try {
      await projectService.saveTask(newTask);
      setNewTaskTitles(prev => ({ ...prev, [stage]: '' }));
      // Reload tasks
      const tList = await projectService.getTasks(selectedProject.id);
      setTasks(tList);
    } catch (e) {
      alert('Error al añadir la tarea.');
    }
  };

  const handleToggleTaskCompleted = async (task: ProyectoTarea) => {
    const updated = { ...task, completed: !task.completed };
    try {
      await projectService.saveTask(updated);
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    } catch (e) {
      alert('Error al actualizar tarea.');
    }
  };

  const handleAssignAgentToTask = async (task: ProyectoTarea, agentId: string | null) => {
    const updated = { ...task, assigned_agent_id: agentId || null };
    try {
      await projectService.saveTask(updated);
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    } catch (e) {
      alert('Error al asignar agente a la tarea.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await projectService.deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (e) {
      alert('Error al eliminar tarea.');
    }
  };

  // AI Weekly Report Generator
  const handleGenerateWeeklyReportAI = async () => {
    if (!selectedProject) return;
    setGeneratingReport(true);
    try {
      const completedList = tasks.filter(t => t.completed).map(t => `- ${t.title}`).join('\n');
      const pendingList = tasks.filter(t => !t.completed).map(t => `- ${t.title}`).join('\n');
      
      const prompt = `You are the Lead Project Manager at YEOO Labs. 
Generate a concise and professional Weekly Progress Report (in Spanish) for the software project: "${selectedProject.name}".
Reference details:
- Project Description: ${selectedProject.description}
- Project SOW / Knowledge: ${selectedProject.memory_bank}
- Tasks completed this week:
${completedList || 'None.'}
- Remaining tasks:
${pendingList || 'None.'}

Format the report into exactly three sections:
1. "Trabajo Completado" (Bullet points of progress)
2. "Próximos Pasos" (Next immediate tasks)
3. "Riesgos / Bloqueos" (Any risks or blockers, or write "Ninguno" if none are obvious)

You MUST respond ONLY with a valid JSON object matching the following structure:
{
  "completed": "Text describing work completed...",
  "next_steps": "Text describing next steps...",
  "blockers": "Text describing blockers or risks..."
}
Do NOT include markdown block ticks (no \`\`\`json) and no conversational text. Return only the raw JSON.`;

      const response = await generateWithProvider(provider, {
        model,
        prompt,
        temperature: 0.7
      });

      let jsonStr = response.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
      }

      const reportData = JSON.parse(jsonStr);
      
      setSelectedProject(prev => {
        if (!prev) return null;
        return {
          ...prev,
          weekly_report: {
            completed: reportData.completed || '',
            next_steps: reportData.next_steps || '',
            blockers: reportData.blockers || ''
          }
        };
      });
      alert('Reporte generado exitosamente con IA. Por favor, revísalo y guárdalo.');
    } catch (err) {
      console.error(err);
      alert('Error al generar el reporte con IA. Rellena los campos manualmente.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleSaveWeeklyReport = async () => {
    if (!selectedProject) return;
    setSaving(true);
    try {
      await projectService.saveProject(selectedProject);
      await loadAllData();
      alert('Reporte semanal guardado exitosamente.');
    } catch (e) {
      alert('Error al guardar reporte.');
    } finally {
      setSaving(false);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.client_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeColor = (status: Proyecto['status']) => {
    switch (status) {
      case 'planificacion': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'desarrollo': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'pruebas_qa': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'entregado': return 'bg-green-500/10 text-green-400 border border-green-500/20';
    }
  };

  // Filter agents that are assigned to the project
  const assignedAgentsList = allAgents.filter(a => selectedProject?.assigned_agents.includes(a.id));

  const inputClass = "w-full bg-[#111622] border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500";
  const labelClass = "text-[10px] font-semibold text-gray-400 uppercase tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0B0F17] border border-gray-800 rounded-2xl shadow-2xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center">
              <FolderOpen size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Administración de Proyectos</h2>
              <p className="text-xs text-gray-500">Supervisa las etapas de desarrollo, administra las tareas de tu equipo y genera reportes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-all text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: Projects list */}
          <div className="w-1/3 border-r border-gray-800 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 bg-[#0E131F] border-b border-gray-800 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar proyectos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#070A0F] border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-between items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-[#070A0F] border border-gray-800 text-[10px] p-1.5 rounded text-gray-400 focus:outline-none"
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="planificacion">Planificación</option>
                  <option value="desarrollo">Desarrollo</option>
                  <option value="pruebas_qa">Pruebas QA</option>
                  <option value="entregado">Entregado</option>
                </select>

                <button
                  onClick={() => {
                    setSelectedProject(NUEVO_PROSPECTO() as any);
                    setTasks([]);
                    setIsEditing(true);
                    setActiveTab('details');
                  }}
                  className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all uppercase"
                >
                  <Plus size={12} />
                  Nuevo
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 size={24} className="animate-spin text-red-500" />
                </div>
              ) : error ? (
                <div className="p-4 bg-red-950/20 border border-red-900/30 text-red-400 rounded-xl text-xs">
                  {error}
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500 text-center">
                  <FolderOpen size={36} className="text-gray-800 mb-2" />
                  <p className="text-xs">No hay proyectos activos.</p>
                </div>
              ) : (
                filteredProjects.map((p) => {
                  const isSelected = selectedProject?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectProject(p)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-[#111622]/50 border-gray-800/80 hover:border-gray-700/80'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-xs truncate max-w-[70%]">{p.name}</h4>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${getStatusBadgeColor(p.status)}`}>
                          {p.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 truncate">
                        {p.client_name || 'Sin cliente asignado'}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: Tab views */}
          <div className="w-2/3 bg-[#090C12] flex flex-col overflow-hidden">
            {selectedProject ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tabs selection */}
                <div className="px-6 border-b border-gray-850 bg-[#0E131F]/50 flex justify-between items-center">
                  <div className="flex gap-4">
                    {(['details', 'tasks', 'memory', 'report'] as const).map((tabId) => (
                      <button
                        key={tabId}
                        onClick={() => setActiveTab(tabId)}
                        className={`py-3 text-xs font-semibold border-b-2 transition-all capitalize ${
                          activeTab === tabId
                            ? 'border-red-500 text-white'
                            : 'border-transparent text-gray-400 hover:text-white'
                        }`}
                      >
                        {tabId === 'details' ? 'Ficha Técnica' : tabId === 'tasks' ? 'Tareas por Etapas' : tabId === 'memory' ? 'Memory Bank' : 'Reporte Semanal'}
                      </button>
                    ))}
                  </div>

                  {!isEditing && activeTab === 'details' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded bg-[#1A1F2E] border border-gray-800 text-gray-300 hover:text-white transition-all font-semibold uppercase"
                      >
                        <Edit2 size={10} />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteProject(selectedProject.id)}
                        className="p-1 text-red-500 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 rounded transition-colors"
                        title="Eliminar Proyecto"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Tab content area */}
                <div className="flex-1 overflow-y-auto p-6">
                  {activeTab === 'details' && (
                    isEditing ? (
                      <form onSubmit={handleSaveProject} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1 col-span-2">
                            <label className={labelClass}>Nombre del Proyecto</label>
                            <input
                              type="text"
                              value={selectedProject.name}
                              onChange={(e) => setSelectedProject({ ...selectedProject, name: e.target.value })}
                              placeholder="Ej: CRM Dental Care"
                              className={inputClass}
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className={labelClass}>Cliente</label>
                            <select
                              value={selectedProject.client_name}
                              onChange={(e) => setSelectedProject({ ...selectedProject, client_name: e.target.value })}
                              className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none"
                            >
                              <option value="">-- Sin Cliente --</option>
                              {clients.map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className={labelClass}>Estado</label>
                            <select
                              value={selectedProject.status}
                              onChange={(e) => setSelectedProject({ ...selectedProject, status: e.target.value as any })}
                              className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none"
                            >
                              <option value="planificacion">Planificación</option>
                              <option value="desarrollo">Desarrollo</option>
                              <option value="pruebas_qa">Pruebas QA</option>
                              <option value="entregado">Entregado</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className={labelClass}>Presupuesto ($)</label>
                            <input
                              type="text"
                              value={selectedProject.budget}
                              onChange={(e) => setSelectedProject({ ...selectedProject, budget: e.target.value })}
                              placeholder="Ej: 5,000 USD"
                              className={inputClass}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className={labelClass}>Fecha Límite</label>
                            <input
                              type="text"
                              value={selectedProject.deadline}
                              onChange={(e) => setSelectedProject({ ...selectedProject, deadline: e.target.value })}
                              placeholder="Ej: 30 de Septiembre"
                              className={inputClass}
                            />
                          </div>

                          <div className="space-y-1 col-span-2">
                            <label className={labelClass}>Descripción del Proyecto</label>
                            <textarea
                              value={selectedProject.description}
                              onChange={(e) => setSelectedProject({ ...selectedProject, description: e.target.value })}
                              placeholder="Describir los objetivos y alcances comerciales generales..."
                              rows={3}
                              className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none resize-none"
                            />
                          </div>

                          {/* Agent Team Assignment */}
                          <div className="space-y-2 col-span-2 border-t border-gray-850 pt-3">
                            <label className={labelClass}>Asignación de Equipo (Agentes)</label>
                            <p className="text-[10px] text-gray-500 mb-2">Selecciona los especialistas asignados al desarrollo técnico del proyecto:</p>
                            <div className="grid grid-cols-2 gap-2 max-h-[15vh] overflow-y-auto pr-2">
                              {allAgents.map(ag => {
                                const isAssigned = selectedProject.assigned_agents.includes(ag.id);
                                return (
                                  <button
                                    key={ag.id}
                                    type="button"
                                    onClick={() => toggleAgentAssignment(ag.id)}
                                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all text-xs ${
                                      isAssigned 
                                        ? 'bg-red-500/10 border-red-500/30 text-white' 
                                        : 'bg-[#111622] border-gray-800 text-gray-400 hover:border-gray-700'
                                    }`}
                                  >
                                    {isAssigned ? <UserCheck size={14} className="text-red-400" /> : <Users size={14} />}
                                    <span className="truncate">{ag.name} ({ag.division})</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={saving}
                          className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs disabled:opacity-50 mt-4"
                        >
                          {saving ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Guardando Proyecto...
                            </>
                          ) : (
                            <>
                              <Save size={14} />
                              Guardar Cambios
                            </>
                          )}
                        </button>
                      </form>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex justify-between items-start border-b border-gray-850 pb-4">
                          <div>
                            <h3 className="text-2xl font-bold text-white mb-2">{selectedProject.name}</h3>
                            <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                              <span className="flex items-center gap-1"><Briefcase size={12} /> {selectedProject.client_name || 'Sin cliente'}</span>
                              <span className="flex items-center gap-1"><Cpu size={12} /> {selectedProject.budget || 'Presupuesto n/d'}</span>
                              <span className="flex items-center gap-1"><Clock size={12} /> {selectedProject.deadline || 'Sin fecha de entrega'}</span>
                            </div>
                          </div>
                          <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase ${getStatusBadgeColor(selectedProject.status)}`}>
                            {selectedProject.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Descripción del Proyecto</h4>
                          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {selectedProject.description || 'Sin descripción registrada. Haz clic en Editar para ingresar una.'}
                          </p>
                        </div>

                        {/* Assigned Team List */}
                        <div className="space-y-2 border-t border-gray-850 pt-4">
                          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Users size={12} className="text-red-400" />
                            Equipo Técnico Asignado ({assignedAgentsList.length})
                          </h4>
                          {assignedAgentsList.length === 0 ? (
                            <p className="text-xs text-gray-500 italic">No hay agentes asignados a este proyecto comercial.</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {assignedAgentsList.map(ag => (
                                <div key={ag.id} className="bg-[#111622]/50 border border-gray-850 p-2.5 rounded-xl flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
                                  <div>
                                    <p className="text-xs font-semibold text-gray-200">{ag.name}</p>
                                    <p className="text-[10px] text-gray-500">{ag.division}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}

                  {activeTab === 'tasks' && (
                    <div className="h-full flex flex-col space-y-4">
                      {loadingTasks ? (
                        <div className="flex justify-center items-center py-20">
                          <Loader2 size={24} className="animate-spin text-red-500" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-3 h-full overflow-y-auto pr-1">
                          {/* Stages Column Layout */}
                          {(['planificacion', 'desarrollo', 'pruebas_qa', 'entregado'] as const).map(stageKey => {
                            const stageTasks = tasks.filter(t => t.stage === stageKey);
                            const titleCapitalized = stageKey === 'pruebas_qa' ? 'Pruebas QA' : stageKey.replace('_', ' ');
                            
                            return (
                              <div key={stageKey} className="bg-[#0E131F]/40 border border-gray-850 rounded-xl flex flex-col p-3 space-y-2 h-[50vh]">
                                <div className="flex justify-between items-center border-b border-gray-800 pb-1.5 mb-1.5">
                                  <h4 className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">{titleCapitalized}</h4>
                                  <span className="text-[9px] bg-[#111622] text-gray-400 px-1.5 py-0.5 rounded font-semibold">
                                    {stageTasks.length}
                                  </span>
                                </div>

                                {/* Task input */}
                                <div className="flex gap-1.5 mb-2">
                                  <input
                                    type="text"
                                    placeholder="Nueva tarea..."
                                    value={newTaskTitles[stageKey]}
                                    onChange={(e) => setNewTaskTitles(prev => ({ ...prev, [stageKey]: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask(stageKey)}
                                    className="flex-1 bg-[#070A0F] border border-gray-800 rounded p-1.5 text-[10px] text-white focus:outline-none focus:border-red-500"
                                  />
                                  <button
                                    onClick={() => handleAddTask(stageKey)}
                                    className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                                    title="Añadir Tarea"
                                  >
                                    <Plus size={10} />
                                  </button>
                                </div>

                                {/* Task list */}
                                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                  {stageTasks.length === 0 ? (
                                    <p className="text-[10px] text-gray-600 text-center italic py-6">Sin tareas</p>
                                  ) : (
                                    stageTasks.map(t => (
                                      <div key={t.id} className="bg-[#111622]/80 border border-gray-850 p-2.5 rounded-lg space-y-1.5">
                                        <div className="flex items-start gap-1.5 justify-between">
                                          <button
                                            onClick={() => handleToggleTaskCompleted(t)}
                                            className="text-gray-500 hover:text-red-400 transition-colors mt-0.5"
                                          >
                                            {t.completed ? <CheckSquare size={12} className="text-green-500" /> : <Square size={12} />}
                                          </button>
                                          <span className={`text-[10px] flex-1 leading-snug break-words ${t.completed ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                                            {t.title}
                                          </span>
                                          <button
                                            onClick={() => handleDeleteTask(t.id)}
                                            className="text-gray-600 hover:text-red-400 p-0.5 rounded transition-colors"
                                            title="Eliminar Tarea"
                                          >
                                            <Trash2 size={10} />
                                          </button>
                                        </div>

                                        {/* Agent assignment dropdown (optional) */}
                                        <div className="flex items-center gap-1.5 border-t border-gray-850/50 pt-1.5">
                                          <select
                                            value={t.assigned_agent_id || ''}
                                            onChange={(e) => handleAssignAgentToTask(t, e.target.value || null)}
                                            className="w-full bg-[#070A0F] border border-gray-850 rounded p-1 text-[8px] text-gray-400 focus:outline-none"
                                          >
                                            <option value="">-- Sin asignar --</option>
                                            {assignedAgentsList.map(a => (
                                              <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                            {assignedAgentsList.length === 0 && (
                                              <option disabled>Asigna agentes al proyecto primero</option>
                                            )}
                                          </select>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'memory' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-gray-850 pb-2">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <BookOpen size={14} className="text-red-400" />
                          Memory Bank del Proyecto
                        </h3>
                        <button
                          onClick={async () => {
                            setSaving(true);
                            try {
                              await projectService.saveProject(selectedProject);
                              alert('Memory Bank guardado exitosamente.');
                            } catch (e) {
                              alert('Error al guardar.');
                            } finally {
                              setSaving(false);
                            }
                          }}
                          disabled={saving}
                          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow shadow-red-950/20 disabled:opacity-50"
                        >
                          <Save size={12} />
                          Guardar Memory
                        </button>
                      </div>

                      <p className="text-[10px] text-gray-500">Este documento contiene los requerimientos técnicos y de negocio que los agentes utilizarán como base de memoria de trabajo cuando converses con ellos.</p>
                      
                      <textarea
                        value={selectedProject.memory_bank}
                        onChange={(e) => setSelectedProject({ ...selectedProject, memory_bank: e.target.value })}
                        placeholder="# Memory Bank del Proyecto&#10;&#10;## Requerimientos Clave:&#10;- Desarrollar base de datos PostgreSQL...&#10;&#10;## Arquitectura Técnica:&#10;- Frontend: React + TypeScript..."
                        rows={16}
                        className="w-full bg-[#111622] border border-gray-800 rounded-xl p-4 text-xs text-gray-300 placeholder-gray-700 focus:outline-none focus:border-red-500 font-mono resize-none leading-relaxed"
                      />
                    </div>
                  )}

                  {activeTab === 'report' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-gray-850 pb-2">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText size={14} className="text-red-400" />
                          Reporte de Avance Semanal
                        </h3>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={handleGenerateWeeklyReportAI}
                            disabled={generatingReport}
                            className="flex items-center gap-1.5 bg-[#1A1F2E] border border-gray-800 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                          >
                            {generatingReport ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                Redactando con IA...
                              </>
                            ) : (
                              <>
                                <Cpu size={12} className="text-red-400" />
                                Generar con IA
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleSaveWeeklyReport}
                            disabled={saving}
                            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow shadow-red-950/20 disabled:opacity-50"
                          >
                            <Save size={12} />
                            Guardar Reporte
                          </button>
                        </div>
                      </div>

                      <p className="text-[10px] text-gray-500">Reporte ejecutivo semanal para el cliente. Puedes rellenarlo a mano o pulsar Generar con IA para que los agentes resuman el avance en función de las tareas completadas y del Memory Bank.</p>
                      
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className={labelClass}>1. Trabajo Completado (Completado)</label>
                          <textarea
                            value={selectedProject.weekly_report.completed}
                            onChange={(e) => setSelectedProject({
                              ...selectedProject,
                              weekly_report: { ...selectedProject.weekly_report, completed: e.target.value }
                            })}
                            placeholder="Ej: Se finalizó el modelado de base de datos y se diseñaron las APIs de autenticación..."
                            rows={4}
                            className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-500 resize-none font-sans leading-relaxed"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className={labelClass}>2. Próximos Pasos (Next Steps)</label>
                          <textarea
                            value={selectedProject.weekly_report.next_steps}
                            onChange={(e) => setSelectedProject({
                              ...selectedProject,
                              weekly_report: { ...selectedProject.weekly_report, next_steps: e.target.value }
                            })}
                            placeholder="Ej: Integración de la pasarela de pagos Stripe y desarrollo de vistas de perfil..."
                            rows={3}
                            className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-500 resize-none font-sans leading-relaxed"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className={labelClass}>3. Riesgos / Bloqueos (Blockers)</label>
                          <textarea
                            value={selectedProject.weekly_report.blockers}
                            onChange={(e) => setSelectedProject({
                              ...selectedProject,
                              weekly_report: { ...selectedProject.weekly_report, blockers: e.target.value }
                            })}
                            placeholder="Ej: Demora en la entrega de credenciales por parte del cliente. Riesgo: Bajo..."
                            rows={3}
                            className="w-full bg-[#111622] border border-gray-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-500 resize-none font-sans leading-relaxed"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col justify-center items-center text-center p-6 text-gray-500 space-y-4">
                <FolderOpen size={48} className="text-gray-800" />
                <div className="max-w-xs space-y-1">
                  <h4 className="font-bold text-gray-400">Panel de Proyectos</h4>
                  <p className="text-xs">Selecciona un proyecto de la lista izquierda para administrar sus etapas de desarrollo, su Memory Bank y sus reportes de avance.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
