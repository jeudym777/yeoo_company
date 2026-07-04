import { supabase } from './supabase';
import { generateWithProvider } from './provider-router';
import type { Provider } from '../types';

export interface Lead {
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
  status: 'new' | 'contacted' | 'interested' | 'replied' | 'archived';
  created_at?: string;
}

class ProspectingService {
  private buildProspectingPrompt(industry: string, location: string): string {
    return `You are Alejandro Castillo, CEO & Founder of YEOO Labs. You are a B2B sales prospector expert in Spanish/LATAM markets.
Search and identify 5-8 highly realistic potential companies/clients that need software or digital transformation in:
Industry: "${industry}"
Location/Region: "${location}"

For each potential client, you must:
1. Provide a realistic company name and mock local domain (e.g. .es, .cr, .co, .mx depending on region).
2. Propose a realistic contact person (e.g., Owner, General Manager) and typical business email/phone.
3. Identify 2-3 technical and business PAIN POINTS they likely suffer from (e.g., no online reservations, outdated mobile UI, lacks WhatsApp automation, slow website, no SEO).
4. Draft a highly compelling, personalized cold email pitch (in Spanish) from YEOO Labs, offering a specific software solution matching their pain points, and inviting them to a brief 10-minute audit call. Make the tone professional, friendly, and LATAM-adapted (no generic templates).

You MUST return ONLY a valid JSON array of objects. Do NOT include markdown backticks (no \`\`\`json), explanation, or note. Return ONLY the raw JSON.

JSON Schema:
[
  {
    "company_name": "Name of the business",
    "contact_name": "Name of the decision maker",
    "email": "contact@domain.com",
    "website": "http://www.domain.com",
    "phone": "+34 XXXXXXXXX / +506 XXXXXXXX",
    "pain_points": "Bullet points list of technical and business pain points",
    "draft_proposal": "Full text of the cold pitch email draft"
  }
]`;
  }

  async prospectLeads(
    industry: string,
    location: string,
    provider: Provider,
    model: string
  ): Promise<Lead[]> {
    try {
      const prompt = this.buildProspectingPrompt(industry, location);

      const response = await generateWithProvider(provider, {
        model,
        prompt,
        temperature: 0.8,
      });

      // Clean the response
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
      }

      const rawLeads = JSON.parse(jsonStr);
      if (!Array.isArray(rawLeads)) throw new Error('Response is not a JSON array');

      return rawLeads.map((item: any, idx: number) => ({
        id: `lead-tmp-${Date.now()}-${idx}`,
        company_name: item.company_name || 'Empresa Inc',
        contact_name: item.contact_name || 'Gerente',
        email: item.email || '',
        website: item.website || '',
        phone: item.phone || '',
        industry,
        notes: `Prospected in ${location}`,
        pain_points: item.pain_points || '',
        draft_proposal: item.draft_proposal || '',
        status: 'new' as const,
      }));
    } catch (e) {
      console.error('Error in lead prospecting:', e);
      throw new Error('Failed to parse lead prospecting results. Try again.');
    }
  }

  async getSavedLeads(): Promise<Lead[]> {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching saved leads:', error);
      throw error;
    }
    return data || [];
  }

  async saveLead(lead: Lead): Promise<void> {
    // Generate clean ID if temporary
    const cleanId = lead.id.startsWith('lead-tmp-')
      ? `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      : lead.id;

    const { error } = await supabase.from('leads').insert({
      id: cleanId,
      company_name: lead.company_name,
      contact_name: lead.contact_name,
      email: lead.email,
      website: lead.website,
      phone: lead.phone,
      industry: lead.industry,
      notes: lead.notes,
      pain_points: lead.pain_points,
      draft_proposal: lead.draft_proposal,
      status: lead.status,
    });

    if (error) {
      console.error('Error saving lead to Supabase:', error);
      throw error;
    }
  }

  async updateLeadStatus(id: string, status: Lead['status']): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('Error updating lead status:', error);
      throw error;
    }
  }

  async deleteLead(id: string): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting lead:', error);
      throw error;
    }
  }
}

export const prospectingService = new ProspectingService();
