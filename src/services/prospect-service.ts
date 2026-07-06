import { supabase } from './supabase';

export interface Prospect {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  website: string;
  phone: string;
  industry: string;
  notes: string;
  pain_points: string;
  draft_proposal: string;
  status: 'esperando' | 'aceptado' | 'rechazado';
  feedback: string;
  created_at?: string;
  updated_at?: string;
}

class ProspectService {
  async getAll(): Promise<Prospect[]> {
    const { data, error } = await supabase
      .from('prospecto')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching prospects:', error);
      throw error;
    }
    return data || [];
  }

  async save(prospect: Prospect): Promise<void> {
    const { error } = await supabase.from('prospecto').upsert({
      id: prospect.id,
      company_name: prospect.company_name,
      contact_name: prospect.contact_name,
      email: prospect.email,
      website: prospect.website,
      phone: prospect.phone,
      industry: prospect.industry,
      notes: prospect.notes,
      pain_points: prospect.pain_points,
      draft_proposal: prospect.draft_proposal,
      status: prospect.status,
      feedback: prospect.feedback,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error saving prospect:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('prospecto')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting prospect:', error);
      throw error;
    }
  }
}

export const prospectService = new ProspectService();
