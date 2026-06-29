import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType } from 'docx';
import type { Agent } from '../types';
import type { SrdOptions } from '../components/SRDModal';

interface SrdInput {
  projectName: string;
  agents: Agent[];
  messages: { role: string; content: string; agentName?: string; timestamp: string }[];
  options?: SrdOptions;
}

interface ParsedRequirement {
  code: string;
  name: string;
  description: string;
  priority: string;
  agentName: string;
}

interface AgentSection {
  agentName: string;
  role: string;
  requirements: ParsedRequirement[];
  risks: { risk: string; probability: string; impact: string; mitigation: string }[];
  timeEstimates: { module: string; hours: number }[];
  analysis: string;
}

const DEFAULT_OPTS: SrdOptions = {
  includeFunctional: true,
  includeNonFunctional: true,
  includeRisks: true,
  includeTimeEstimate: true,
  includeAgentAnalysis: true,
  includeConclusion: true,
  includeBarChart: true,
  includeRiskMatrix: true,
  includeBudgetPie: false,
  maxReqsPerAgent: 8,
  maxAnalysisChars: 2000,
  outputFormat: 'docx',
};

class SrdGenerator {
  private parseRequirements(allContent: string, agentName: string, codePrefix: number): ParsedRequirement[] {
    const requirements: ParsedRequirement[] = [];
    let reqIndex = codePrefix;

    const broadMatch = allContent.matchAll(/RF-(\d{1,3})\s*[:.\-\s]+([\s\S]*?)(?=\n\s*(?:RF-\d|Prioridad|Conclusión|$))/gi);
    const rfMatches: { code: string; rest: string }[] = [];
    for (const m of broadMatch) {
      rfMatches.push({ code: `RF-${m[1]}`, rest: m[2].trim() });
    }

    if (rfMatches.length > 0) {
      for (const rf of rfMatches) {
        const priorityMatch = rf.rest.match(/prioridad\s*[:.\-\s]*(alta|media|baja)/i);
        const priority = priorityMatch ? priorityMatch[1].charAt(0).toUpperCase() + priorityMatch[1].slice(1).toLowerCase() : 'Media';
        let desc = rf.rest.replace(/prioridad\s*[:.\-\s]*(alta|media|baja)/gi, '').trim();
        if (!desc) desc = rf.rest.trim();
        requirements.push({ code: rf.code, name: `Requerimiento ${rf.code}`, description: desc, priority, agentName });
      }
      return requirements;
    }

    const lines = allContent.split('\n');
    let currentReq: Partial<ParsedRequirement> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      const headerMatch = trimmed.match(/^(?:RF-(\d{1,3})|\d+[\.)])\s*[:.\-\s]*(.+)/);
      if (headerMatch) {
        if (currentReq?.description) requirements.push(this.buildReq(currentReq, agentName, reqIndex++));
        currentReq = { name: headerMatch[2].trim() || `Requerimiento ${reqIndex}`, description: '', priority: 'Media', agentName };
        continue;
      }
      const priorityMatch = trimmed.match(/prioridad\s*[:.\-\s]*(alta|media|baja)/i);
      if (priorityMatch && currentReq) {
        currentReq.priority = priorityMatch[1].charAt(0).toUpperCase() + priorityMatch[1].slice(1).toLowerCase();
        continue;
      }
      if (/^(nombre de proyecto|proyecto|equipo|agentes|fecha)/i.test(trimmed)) continue;
      if (trimmed.length < 3) continue;
      if (currentReq) {
        currentReq.description = currentReq.description ? currentReq.description + ' ' + trimmed : trimmed;
      }
    }

    if (currentReq?.description) requirements.push(this.buildReq(currentReq, agentName, reqIndex++));

    if (requirements.length === 0) {
      const reqLines = lines.filter((l) => /^[\s]*[-•*\d]/.test(l.trim()) && l.trim().length > 10).slice(0, 10);
      reqLines.forEach((line, i) => {
        const text = line.replace(/^[\s]*[-•*\d.]+\s*/, '').trim().substring(0, 300);
        if (text) {
          requirements.push({ code: `RF-${String(reqIndex + i + 1).padStart(2, '0')}`, name: text.split('.')[0]?.substring(0, 60) || text.substring(0, 60), description: text, priority: i < 3 ? 'Alta' : i < 6 ? 'Media' : 'Baja', agentName });
        }
      });
    }
    return requirements;
  }

  private buildReq(p: Partial<ParsedRequirement>, agentName: string, idx: number): ParsedRequirement {
    return { code: `RF-${String(idx + 1).padStart(2, '0')}`, name: (p.name || `Requerimiento ${idx + 1}`).substring(0, 100), description: (p.description || '').substring(0, 2000), priority: p.priority || 'Media', agentName };
  }

  private parseAgentContributions(input: SrdInput, opts: SrdOptions): AgentSection[] {
    const sections: AgentSection[] = [];
    let globalReqIndex = 0;
    const maxReqs = opts.maxReqsPerAgent ?? 8;
    const maxAnalysis = opts.maxAnalysisChars ?? 2000;

    for (const agent of input.agents) {
      const agentMessages = input.messages.filter((m) => m.agentName === agent.name);
      if (agentMessages.length === 0) continue;
      const combinedContent = agentMessages.map((m) => m.content).join('\n\n');
      const allReqs = this.parseRequirements(combinedContent, agent.name, globalReqIndex);
      const requirements = allReqs.slice(0, maxReqs);
      globalReqIndex += allReqs.length;

      const risks: { risk: string; probability: string; impact: string; mitigation: string }[] = [];
      const riskMatches = combinedContent.match(/risk|riesgo|mitigación|mitigation/gi);
      if (riskMatches?.length) {
        for (const line of combinedContent.split('\n').filter((l) => /risk|riesgo/.test(l.toLowerCase()) && l.trim().length > 10).slice(0, 5)) {
          risks.push({ risk: line.substring(0, 200).trim(), probability: 'Media', impact: 'Alta', mitigation: 'Monitoreo y plan de contingencia' });
        }
      }
      if (!risks.length) risks.push({ risk: 'Complejidad de integración', probability: 'Media', impact: 'Media', mitigation: 'Plan de pruebas exhaustivo' });

      const timeEstimates: { module: string; hours: number }[] = [];
      const timeMatches = combinedContent.match(/(\d+)\s*(hours|hrs|horas|weeks|semanas|months|meses)/gi);
      if (timeMatches) {
        for (const m of timeMatches.slice(0, 5)) {
          timeEstimates.push({ module: `${agent.name} - ${agent.division}`, hours: parseInt(m.replace(/[^0-9]/g, '')) || 40 });
        }
      }
      if (!timeEstimates.length) timeEstimates.push({ module: `${agent.division} desarrollo`, hours: 80 });

      sections.push({ agentName: agent.name, role: agent.division, requirements, risks, timeEstimates, analysis: combinedContent.substring(0, maxAnalysis).trim() });
    }
    return sections;
  }

  private border() { return { top: { style: BorderStyle.SINGLE, size: 1, color: '7C3AED' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '7C3AED' }, left: { style: BorderStyle.SINGLE, size: 1, color: '7C3AED' }, right: { style: BorderStyle.SINGLE, size: 1, color: '7C3AED' } }; }
  private hCell(text: string, w = 25): TableCell { return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20, font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 } })], shading: { type: ShadingType.SOLID, color: '7C3AED', fill: '7C3AED' }, borders: this.border(), width: { size: w, type: WidthType.PERCENTAGE } }); }
  private cCell(text: string, w = 25, bold = false): TableCell { return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, size: 18, font: 'Calibri', bold })], spacing: { before: 80, after: 80 } })], borders: this.border(), width: { size: w, type: WidthType.PERCENTAGE } }); }

  async generateSrd(input: SrdInput): Promise<Blob> {
    const opts = { ...DEFAULT_OPTS, ...(input.options || {}) };
    const sections = this.parseAgentContributions(input, opts);
    const allReqs = sections.flatMap((s) => s.requirements);
    const children: any[] = [];

    children.push(
      new Paragraph({ text: 'DOCUMENTO DE REQUERIMIENTOS DE SOFTWARE', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
      new Paragraph({ text: `Nombre de Proyecto: ${input.projectName}`, spacing: { after: 100 }, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Fecha: ${new Date().toLocaleDateString('es-CR')}`, spacing: { after: 100 }, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Equipo: ${input.agents.filter((a) => input.messages.some((m) => m.agentName === a.name)).map((a) => a.name).join(', ')}`, spacing: { after: 100 }, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Agentes participantes: ${input.agents.filter((a) => input.messages.some((m) => m.agentName === a.name)).length} de ${input.agents.length}`, spacing: { after: 500 }, alignment: AlignmentType.CENTER }),
    );

    if (opts.includeFunctional) {
      children.push(new Paragraph({ text: '1. MATRIZ DE REQUERIMIENTOS FUNCIONALES', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
      children.push(new Paragraph({ text: `Nombre de Proyecto: ${input.projectName}`, spacing: { after: 150 } }));
      if (allReqs.length) {
        const rows: TableRow[] = [new TableRow({ children: [this.hCell('Código', 8), this.hCell('Nombre', 17), this.hCell('Descripción', 50), this.hCell('Prioridad', 12), this.hCell('Agente', 13)] })];
        for (const r of allReqs) rows.push(new TableRow({ children: [this.cCell(r.code, 8, true), this.cCell(r.name, 17), this.cCell(r.description, 50), this.cCell(r.priority, 12, r.priority === 'Alta'), this.cCell(r.agentName, 13)] }));
        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
      } else {
        children.push(new Paragraph({ text: 'No se detectaron requerimientos detallados en la conversación.', spacing: { after: 100 } }));
      }
    }

    if (opts.includeNonFunctional) {
      children.push(new Paragraph({ text: '2. REQUERIMIENTOS NO FUNCIONALES', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
      const nfrRows = [new TableRow({ children: [this.hCell('Requerimiento', 45), this.hCell('Categoría', 25), this.hCell('Agente', 30)] })];
      nfrRows.push(new TableRow({ children: [this.cCell('Alta disponibilidad 99.9%', 45), this.cCell('Disponibilidad', 25), this.cCell('Cloud Architect', 30)] }));
      nfrRows.push(new TableRow({ children: [this.cCell('Tiempo de respuesta < 200ms', 45), this.cCell('Rendimiento', 25), this.cCell('Backend Architect', 30)] }));
      nfrRows.push(new TableRow({ children: [this.cCell('Cifrado de datos en tránsito y reposo', 45), this.cCell('Seguridad', 25), this.cCell('Security Engineer', 30)] }));
      nfrRows.push(new TableRow({ children: [this.cCell('WCAG 2.1 AA', 45), this.cCell('Accesibilidad', 25), this.cCell('UX/UI Designer', 30)] }));
      nfrRows.push(new TableRow({ children: [this.cCell('Infraestructura escalable horizontalmente', 45), this.cCell('Escalabilidad', 25), this.cCell('Cloud Architect', 30)] }));
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: nfrRows }));
    }

    if (opts.includeRisks) {
      children.push(new Paragraph({ text: '3. ANÁLISIS DE RIESGOS', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
      const riskRows = [new TableRow({ children: [this.hCell('Riesgo', 35), this.hCell('Probabilidad', 15), this.hCell('Impacto', 15), this.hCell('Mitigación', 35)] })];
      for (const s of sections) for (const r of s.risks.slice(0, 2)) riskRows.push(new TableRow({ children: [this.cCell(r.risk, 35), this.cCell(r.probability, 15), this.cCell(r.impact, 15), this.cCell(r.mitigation, 35)] }));
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: riskRows }));
    }

    if (opts.includeTimeEstimate) {
      children.push(new Paragraph({ text: '4. ESTIMACIÓN DE TIEMPO', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
      const timeRows = [new TableRow({ children: [this.hCell('Módulo', 50), this.hCell('Horas', 25), this.hCell('Agente', 25)] })];
      let th = 0;
      for (const s of sections) for (const e of s.timeEstimates.slice(0, 2)) { th += e.hours; timeRows.push(new TableRow({ children: [this.cCell(e.module, 50), this.cCell(`${e.hours}h`, 25), this.cCell(s.agentName, 25)] })); }
      timeRows.push(new TableRow({ children: [this.hCell('TOTAL ESTIMADO'), this.hCell(`${th}h (${Math.ceil(th / 40)} semanas)`), this.hCell('')] }));
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: timeRows }));
    }

    if (opts.includeAgentAnalysis) {
      children.push(new Paragraph({ text: '5. ANÁLISIS POR AGENTE', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
      for (const s of sections) {
        children.push(new Paragraph({ text: `${s.agentName} (${s.role})`, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
        children.push(new Paragraph({ text: s.analysis || 'Análisis pendiente.', spacing: { after: 150 } }));
      }
    }

    if (opts.includeConclusion) {
      children.push(new Paragraph({ text: '6. CONCLUSIÓN', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
      const tc = allReqs.length;
      const hc = allReqs.filter((r) => r.priority === 'Alta').length;
      const ca = sections.map((s) => s.agentName).join(', ');
      const eh = sections.reduce((sum, s) => sum + s.timeEstimates.reduce((t, e) => t + e.hours, 0), 0);
      children.push(
        new Paragraph({ text: `Se identificaron un total de ${tc} requerimientos funcionales, de los cuales ${hc} son de prioridad alta.`, spacing: { after: 100 } }),
        new Paragraph({ text: `Agentes contribuyentes: ${ca}.`, spacing: { after: 100 } }),
        new Paragraph({ text: `Horas totales estimadas: ${eh}h (aproximadamente ${Math.ceil(eh / 40)} semanas de trabajo).`, spacing: { after: 100 } }),
        new Paragraph({ text: 'Se recomienda iniciar con los requerimientos de prioridad alta en la primera fase del proyecto, seguido por los de prioridad media en fases posteriores.', spacing: { after: 200 } }),
      );
    }

    return await Packer.toBlob(new Document({ sections: [{ properties: {}, children }] }));
  }
}

export const srdGenerator = new SrdGenerator();