import { supabase } from './supabase';

export interface Proyecto {
  id: string;
  name: string;
  client_name: string;
  status: 'planificacion' | 'desarrollo' | 'pruebas_qa' | 'entregado';
  budget: string;
  deadline: string;
  description: string;
  assigned_agents: string[]; // agent IDs
  memory_bank: string;
  weekly_report: {
    completed: string;
    next_steps: string;
    blockers: string;
  };
  created_at?: string;
}

export interface ProyectoTarea {
  id: string;
  project_id: string;
  title: string;
  stage: 'planificacion' | 'desarrollo' | 'pruebas_qa' | 'entregado';
  assigned_agent_id: string | null;
  completed: boolean;
  created_at?: string;
}

class ProjectService {
  async getProjects(): Promise<Proyecto[]> {
    const { data, error } = await supabase
      .from('projectcontinuos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }

    return (data || []).map(p => ({
      ...p,
      assigned_agents: Array.isArray(p.assigned_agents) ? p.assigned_agents : [],
      weekly_report: p.weekly_report || { completed: '', next_steps: '', blockers: '' }
    }));
  }

  async saveProject(proyecto: Proyecto): Promise<void> {
    const { error } = await supabase.from('projectcontinuos').upsert({
      id: proyecto.id,
      name: proyecto.name,
      client_name: proyecto.client_name,
      status: proyecto.status,
      budget: proyecto.budget,
      deadline: proyecto.deadline,
      description: proyecto.description,
      assigned_agents: proyecto.assigned_agents,
      memory_bank: proyecto.memory_bank,
      weekly_report: proyecto.weekly_report,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error saving project:', error);
      throw error;
    }
  }

  async deleteProject(id: string): Promise<void> {
    const { error } = await supabase
      .from('projectcontinuos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }

  async getTasks(projectId: string): Promise<ProyectoTarea[]> {
    const { data, error } = await supabase
      .from('projectcontinuos_task')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching project tasks:', error);
      throw error;
    }
    return data || [];
  }

  async saveTask(tarea: ProyectoTarea): Promise<void> {
    const { error } = await supabase.from('projectcontinuos_task').upsert({
      id: tarea.id,
      project_id: tarea.project_id,
      title: tarea.title,
      stage: tarea.stage,
      assigned_agent_id: tarea.assigned_agent_id,
      completed: tarea.completed,
    });

    if (error) {
      console.error('Error saving task:', error);
      throw error;
    }
  }

  async deleteTask(id: string): Promise<void> {
    const { error } = await supabase
      .from('projectcontinuos_task')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }
}

export const projectService = new ProjectService();
