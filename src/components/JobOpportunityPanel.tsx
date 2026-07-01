import React, { useState, useEffect } from 'react';
import type { Agent, Provider } from '../types';
import { jobService, type JobOpportunity, type JobSearchFilters } from '../services/job-service';
import { Search, Play, Square, Download, Loader2, ExternalLink, Star, Save, Building2, MapPin, DollarSign, CheckCircle, XCircle, RefreshCw, CheckSquare, Square as SquareIcon, Globe, Server } from 'lucide-react';

interface JobOpportunityPanelProps {
  projectName: string;
  agents: Agent[];
  provider: Provider;
  model: string;
  messages: { role: string; content: string; agentName?: string; timestamp: string }[];
  memoryBankContext: string;
  onClose: () => void;
}

const COUNTRIES = [
  { code: 'us', label: '🇺🇸 Estados Unidos' },
  { code: 'mx', label: '🇲🇽 México' },
  { code: 'cr', label: '🇨🇷 Costa Rica' },
  { code: 'co', label: '🇨🇴 Colombia' },
  { code: 'ar', label: '🇦🇷 Argentina' },
  { code: 'cl', label: '🇨🇱 Chile' },
  { code: 'pe', label: '🇵🇪 Perú' },
  { code: 'gb', label: '🇬🇧 Reino Unido' },
  { code: 'ca', label: '🇨🇦 Canadá' },
];

const DAYS_OPTIONS = [1, 3, 7, 14, 30];

export const JobOpportunityPanel: React.FC<JobOpportunityPanelProps> = ({
  projectName,
  agents,
  provider,
  model,
  messages,
  memoryBankContext,
  onClose,
}) => {
  const [status, setStatus] = useState<'config' | 'searching' | 'analyzing' | 'done' | 'error'>('config');
  const [filters, setFilters] = useState<JobSearchFilters>({
    keywords: '',
    country: 'us',
    results_per_page: 10,
    max_days_old: 7,
  });
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(['indeed', 'computrabajo', 'linkedin', 'empresas_cr', 'adzuna'])
  );

  const toggleSource = (source: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      next.has(source) ? next.delete(source) : next.add(source);
      return next;
    });
  };
  const [jobs, setJobs] = useState<JobOpportunity[]>([]);
  const [analyzedJobs, setAnalyzedJobs] = useState<JobOpportunity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analyzingIndex, setAnalyzingIndex] = useState(-1);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const userContext = jobService.buildUserContext(messages, memoryBankContext);

  const handleSearch = async () => {
    setStatus('searching');
    setError(null);
    try {
      const sources = Array.from(selectedSources);
      if (sources.length === 0) {
        setError('Selecciona al menos una fuente de búsqueda.');
        setStatus('error');
        return;
      }
      const results = await jobService.searchJobs(
        {
          ...filters,
          keywords: filters.keywords || 'software developer',
        },
        Array.from(selectedSources)
      );
      setJobs(results);
      if (results.length === 0) {
        setError('No se encontraron ofertas. Prueba con otras keywords.');
        setStatus('error');
        return;
      }
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error buscando ofertas');
      setStatus('error');
    }
  };

  const handleAnalyzeAll = async () => {
    if (jobs.length === 0) return;
    setStatus('analyzing');
    const results: JobOpportunity[] = [];

    for (let i = 0; i < jobs.length; i++) {
      setAnalyzingIndex(i);
      const job = jobs[i];
      try {
        const analysis = await jobService.analyzeJobOpportunity(
          job,
          agents,
          provider,
          model,
          userContext
        );
        results.push({ ...job, ...analysis });
      } catch {
        results.push({ ...job, matchScore: 0, ceoAnalysis: 'Error', techAnalysis: 'Error' });
      }
    }

    results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    setAnalyzedJobs(results);
    setAnalyzingIndex(-1);
    setStatus('done');
  };

  const handleSaveOpportunity = async (job: JobOpportunity) => {
    setSavingIds((prev) => new Set([...prev, job.id]));
    await jobService.saveOpportunity(job);
    setSavingIds((prev) => {
      const next = new Set(prev);
      next.delete(job.id);
      return next;
    });
    setAnalyzedJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, saved: true } : j)));
  };

  const handleDownloadCSV = () => {
    const data = analyzedJobs.length > 0 ? analyzedJobs : jobs;
    jobService.downloadCSV(data, projectName);
  };

  const handleStop = () => {
    setStatus('done');
    setAnalyzingIndex(-1);
  };

  const displayJobs = analyzedJobs.length > 0 ? analyzedJobs : jobs;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Building2 size={22} className="text-red-400" />
            <h2 className="text-xl font-bold text-white">Job Opportunity Analyzer</h2>
            <span className="text-sm text-slate-500">— {projectName}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl cursor-pointer">✕</button>
        </div>

        {/* Filters + Controls */}
        <div className="p-4 border-b border-slate-700 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] text-slate-500 mb-1">Keywords / Skills</label>
            <input
              value={filters.keywords}
              onChange={(e) => setFilters((p) => ({ ...p, keywords: e.target.value }))}
              placeholder="e.g. React, Node.js, Python"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">País</label>
            <select
              value={filters.country}
              onChange={(e) => setFilters((p) => ({ ...p, country: e.target.value }))}
              className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-red-500"
            >
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-3 border-t border-slate-700">
            {[
              { key: 'indeed', label: '🌐 Indeed', icon: <Globe size={10} />, group: 'Scraping Real' },
              { key: 'computrabajo', label: '💼 Computrabajo', icon: <Globe size={10} />, group: 'Scraping Real' },
              { key: 'linkedin', label: '🔷 LinkedIn', icon: <Globe size={10} />, group: 'Scraping Real' },
              { key: 'empresas_cr', label: '🏢 Empresas CR', icon: <Building2 size={10} />, group: 'Scraping Real' },
              { key: 'adzuna', label: '📡 Adzuna API', icon: <Server size={10} />, group: 'API' },
            ].map(({ key, label, group }) => (
              <button
                key={key}
                onClick={() => toggleSource(key)}
                className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs transition whitespace-nowrap ${
                  selectedSources.has(key)
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : 'bg-[#1A1F2E] border-[#2D3548] text-gray-500 hover:text-gray-300'
                }`}
              >
                {selectedSources.has(key) ? <CheckSquare size={12} /> : <SquareIcon size={12} />} {label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Publicado en</label>
            <select
              value={filters.max_days_old}
              onChange={(e) => setFilters((p) => ({ ...p, max_days_old: parseInt(e.target.value) }))}
              className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-red-500"
            >
              {DAYS_OPTIONS.map((d) => <option key={d} value={d}>{d} {d === 1 ? 'día' : 'días'}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSearch} disabled={status === 'searching' || status === 'analyzing'}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition">
              {status === 'searching' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {status === 'searching' ? 'Searching...' : 'PLAY'}
            </button>
            {(status === 'analyzing') && (
              <button onClick={handleStop} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition">
                <Square size={16} /> STOP
              </button>
            )}
            <button onClick={handleDownloadCSV} disabled={displayJobs.length === 0}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition">
              <Download size={16} /> .csv
            </button>
          </div>
        </div>

        {/* Status */}
        {(status === 'searching' || status === 'analyzing') && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-300 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            {status === 'searching' && `Buscando ofertas en ${Array.from(selectedSources).join(', ')}...`}
            {status === 'analyzing' && `Analizando ofertas con agentes... (${analyzingIndex + 1}/${jobs.length})`}
          </div>
        )}

        {/* Analyze button */}
        {status === 'done' && jobs.length > 0 && analyzedJobs.length === 0 && (
          <div className="px-4 py-3 border-b border-slate-700 flex justify-center">
            <button onClick={handleAnalyzeAll}
              className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-900 600 hover:from-red-500 hover:to-red-900 500 text-white font-bold px-6 py-2 rounded-lg text-sm transition">
              <Star size={16} /> Analyze with AI Agents ({jobs.length} jobs)
            </button>
          </div>
        )}

        {error && status === 'error' && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setStatus('config')} className="text-red-300 hover:text-red-200"><RefreshCw size={14} /></button>
          </div>
        )}

        {/* Results table */}
        <div className="flex-1 overflow-y-auto">
          {displayJobs.length > 0 ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-900">
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left p-3 w-[5%]">#</th>
                  <th className="text-left p-3 w-[18%]">Empresa / Puesto</th>
                  <th className="text-left p-3 w-[12%]">Ubicación</th>
                  <th className="text-left p-3 w-[8%]">Salario</th>
                  {analyzedJobs.length > 0 && <th className="text-left p-3 w-[8%]">Match</th>}
                  {analyzedJobs.length > 0 && <th className="text-left p-3 w-[25%]">Análisis CEO</th>}
                  {analyzedJobs.length > 0 && <th className="text-left p-3 w-[18%]">Análisis Técnico</th>}
                  <th className="text-left p-3 w-[6%]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayJobs.map((job, i) => (
                  <tr key={job.id} className={`border-b border-slate-800 hover:bg-slate-800/50 ${job.matchScore && job.matchScore >= 80 ? 'bg-green-500/5' : ''}`}>
                    <td className="p-3 text-slate-500">{i + 1}</td>
                    <td className="p-3">
                      <p className="text-white font-semibold truncate">{job.title}</p>
                      <p className="text-red-400 text-[10px]">{job.company}</p>
                    </td>
                    <td className="p-3 text-slate-300">
                      <div className="flex items-center gap-1"><MapPin size={10} /> {job.location}</div>
                    </td>
                    <td className="p-3 text-slate-300">
                      {job.salary_min ? (
                        <span className="text-green-400">${job.salary_min.toLocaleString()}{job.salary_max ? `-${job.salary_max.toLocaleString()}` : ''}</span>
                      ) : <span className="text-slate-500">—</span>}
                    </td>
                    {analyzedJobs.length > 0 && (
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-800 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${(job.matchScore || 0) >= 80 ? 'bg-green-400' : (job.matchScore || 0) >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                              style={{ width: `${job.matchScore || 0}%` }}
                            />
                          </div>
                          <span className="text-white font-bold text-[11px]">{job.matchScore}%</span>
                        </div>
                      </td>
                    )}
                    {analyzedJobs.length > 0 && (
                      <td className="p-3 text-slate-400 text-[10px] leading-relaxed">{job.ceoAnalysis?.replace('MATCH_SCORE: ' + (job.matchScore || ''), '').substring(0, 200)}</td>
                    )}
                    {analyzedJobs.length > 0 && (
                      <td className="p-3 text-slate-400 text-[10px] leading-relaxed">{(job.techAnalysis || '').substring(0, 150)}</td>
                    )}
                    <td className="p-3">
                      <div className="flex gap-1">
                        <a href={job.url || '#'} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-red-400 cursor-pointer">
                          <ExternalLink size={12} />
                        </a>
                        <button
                          onClick={() => handleSaveOpportunity(job)}
                          disabled={savingIds.has(job.id) || job.saved}
                          className={`p-1.5 rounded ${job.saved ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'}`}
                        >
                          {savingIds.has(job.id) ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : status !== 'searching' && status !== 'analyzing' && (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <Building2 size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Configura los filtros y presiona PLAY</p>
                <p className="text-sm mt-1">Los agentes analizarán cada oferta vs tu perfil</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};