import { supabase } from './supabase';
import { generateWithProvider } from './provider-router';
import type { Agent, Provider } from '../types';

export interface JobOpportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  description: string;
  url: string;
  created: string;
  category: string;
  full_description: string;
  matchScore?: number;
  ceoAnalysis?: string;
  techAnalysis?: string;
  saved: boolean;
}

export interface JobSearchFilters {
  keywords: string;
  country: string;
  results_per_page: number;
  max_days_old: number;
}

const STORAGE_KEY = 'yeoo_job_results';

class JobService {
  async searchJobs(filters: JobSearchFilters): Promise<JobOpportunity[]> {
    try {
      // Try Cloudflare Function first (production)
      let res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: filters.keywords || 'software engineer',
          country: filters.country || 'us',
          results_per_page: filters.results_per_page || 10,
          max_days_old: filters.max_days_old || 7,
        }),
      });

      // If /api/jobs fails (404 in dev), fall back to direct Adzuna call
      if (!res.ok && res.status !== 200) {
        const appId = '21a60a8d';
        const apiKey = '5fd41eb6a65b65452d243a33cdb57d4c';
        const country = filters.country || 'us';
        const what = encodeURIComponent(filters.keywords || 'software engineer');
        const results = filters.results_per_page || 10;
        const days = filters.max_days_old || 7;
        const directUrl = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${apiKey}&results_per_page=${results}&what=${what}&max_days_old=${days}`;
        
        console.log('Falling back to direct Adzuna call:', directUrl);
        res = await fetch(directUrl, {
          headers: { 'Accept': 'application/json' },
        });
      }

      if (!res.ok) {
        const text = await res.text();
        console.error('Adzuna response status:', res.status, text.substring(0, 200));
        throw new Error(`Adzuna API returned ${res.status}. Check your API credentials or country code.`);
      }

      const data = await res.json();
      const jobs: JobOpportunity[] = (data.results || []).map((j: any) => ({
        id: j.id,
        title: j.title || '',
        company: typeof j.company === 'object' ? (j.company?.display_name || 'Unknown') : (j.company || 'Unknown'),
        location: typeof j.location === 'object' ? (j.location?.display_name || 'Remote') : (j.location || 'Remote'),
        salary_min: j.salary_min || null,
        salary_max: j.salary_max || null,
        description: (j.description || '').substring(0, 1000),
        url: j.redirect_url || '',
        created: j.created || '',
        category: j.category?.label || '',
        full_description: j.description || '',
        saved: false,
      }));

      // Cache for session
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
      return jobs;
    } catch (err) {
      console.warn('JobService.searchJobs error:', err);
      // Return cached results if available
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      } catch {
        return [];
      }
    }
  }

  /**
   * Ask agents to analyze a job opportunity vs user profile
   */
  async analyzeJobOpportunity(
    job: JobOpportunity,
    agents: Agent[],
    provider: Provider,
    model: string,
    userContext: string
  ): Promise<{ matchScore: number; ceoAnalysis: string; techAnalysis: string }> {
    // Find relevant agents
    const ceo = agents.find((a) => a.division === 'Executive') || agents[0];
    const techAgent = agents.find((a) => a.division === 'Engineering' || a.division === 'AI & Data') || agents[0];

    const jobDesc = job.full_description || job.description || job.title;
    const salaryRange = job.salary_min && job.salary_max
      ? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}`
      : job.salary_min ? `$${job.salary_min.toLocaleString()}` : 'Not specified';

    const analysisPrompt = `USER PROFILE CONTEXT:
${userContext}

JOB OPPORTUNITY:
Company: ${job.company}
Title: ${job.title}
Location: ${job.location}
Salary: ${salaryRange}
Description: ${jobDesc.substring(0, 1500)}
`;

    // CEO Analysis
    let ceoAnalysis = '';
    try {
      ceoAnalysis = await generateWithProvider(provider, {
        model,
        prompt: analysisPrompt + '\n\nAs the CEO, evaluate: is this a good career move? Consider growth potential, company reputation, culture fit. Score 0-100. Format: MATCH_SCORE: [number]. Then 2-3 sentences analysis.',
        system: `${ceo.prompt}\n\nBe concise. First line MUST be: MATCH_SCORE: [number 0-100]. Then explain in 2-3 sentences max.`,
        temperature: 0.4,
      });
    } catch { ceoAnalysis = 'MATCH_SCORE: 50\nAnalysis pending.'; }

    // Tech Analysis
    let techAnalysis = '';
    try {
      techAnalysis = await generateWithProvider(provider, {
        model,
        prompt: analysisPrompt + '\n\nAs a senior engineer, evaluate: does my tech stack align? What skills gap exists? Would I grow technically here? Be honest.',
        system: `${techAgent.prompt}\n\nBe concise. Analyze in 2-3 sentences max.`,
        temperature: 0.4,
      });
    } catch { techAnalysis = 'Analysis pending.'; }

    // Extract score
    const scoreMatch = ceoAnalysis.match(/MATCH_SCORE:\s*(\d+)/i);
    const matchScore = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1]))) : 50;

    return { matchScore, ceoAnalysis, techAnalysis };
  }

  /**
   * Save a job opportunity to Supabase
   */
  async saveOpportunity(job: JobOpportunity): Promise<void> {
    try {
      const { error } = await supabase.from('saved_opportunities').upsert({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        description: job.description,
        url: job.url,
        category: job.category,
        match_score: job.matchScore || 0,
        ceo_analysis: job.ceoAnalysis || '',
        tech_analysis: job.techAnalysis || '',
        saved_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (error) console.warn('Save opportunity error:', error);
    } catch (err) {
      console.warn('Save opportunity failed:', err);
    }
  }

  async getSavedOpportunities(): Promise<JobOpportunity[]> {
    try {
      const { data, error } = await supabase
        .from('saved_opportunities')
        .select('*')
        .order('saved_at', { ascending: false });

      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          title: row.title,
          company: row.company,
          location: row.location || '',
          salary_min: row.salary_min,
          salary_max: row.salary_max,
          description: row.description || '',
          url: row.url || '',
          created: row.saved_at || '',
          category: row.category || '',
          full_description: row.description || '',
          matchScore: row.match_score || 0,
          ceoAnalysis: row.ceo_analysis || '',
          techAnalysis: row.tech_analysis || '',
          saved: true,
        }));
      }
    } catch (err) {
      console.warn('getSavedOpportunities error:', err);
    }
    return [];
  }

  /**
   * Build user context from chat messages + Memory Bank
   */
  buildUserContext(
    messages: { role: string; content: string; agentName?: string }[],
    memoryBankContext: string
  ): string {
    const userMessages = messages
      .filter((m) => m.role === 'user' && m.content.length > 20)
      .slice(-5)
      .map((m) => m.content)
      .join('\n');

    const agentResponses = messages
      .filter((m) => m.role === 'assistant' && m.agentName)
      .slice(-3)
      .map((m) => `[${m.agentName}]: ${m.content.substring(0, 200)}`)
      .join('\n');

    return `USER INPUT:\n${userMessages.substring(0, 2000)}\n\nAGENT RESPONSES:\n${agentResponses}\n\nMEMORY BANK:\n${memoryBankContext.substring(0, 1000)}`;
  }

  /**
   * Export opportunities to CSV
   */
  exportToCSV(jobs: JobOpportunity[]): string {
    const headers = ['Empresa', 'Puesto', 'Match%', 'Salario Min', 'Salario Max', 'Ubicación', 'Análisis CEO', 'Análisis Técnico', 'URL'];
    const rows = jobs.map((j) => [
      `"${j.company.replace(/"/g, '""')}"`,
      `"${j.title.replace(/"/g, '""')}"`,
      j.matchScore || 0,
      j.salary_min || '',
      j.salary_max || '',
      `"${j.location.replace(/"/g, '""')}"`,
      `"${(j.ceoAnalysis || '').replace(/"/g, '""')}"`,
      `"${(j.techAnalysis || '').replace(/"/g, '""')}"`,
      j.url,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  downloadCSV(jobs: JobOpportunity[], projectName: string): void {
    const csv = this.exportToCSV(jobs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job_opportunities_${projectName.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const jobService = new JobService();