import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle, TableLayoutType, ShadingType } from 'docx';
import type { Agent } from '../types';

interface SrdInput {
  projectName: string;
  agents: Agent[];
  messages: { role: string; content: string; agentName?: string; timestamp: string }[];
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

class SrdGenerator {
  private parseRequirements(allContent: string, agentName: string, codePrefix: number): ParsedRequirement[] {
    const requirements: ParsedRequirement[] = [];
    let reqIndex = codePrefix;

    // Strategy 1: Look for RF- pattern explicitly
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
        requirements.push({
          code: rf.code,
          name: `Requerimiento ${rf.code}`,
          description: desc,
          priority,
          agentName,
        });
      }
      return requirements;
    }

    // Strategy 2: Look for numbered/bullet requirements
    const lines = allContent.split('\n');
    let currentReq: Partial<ParsedRequirement> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      const headerMatch = trimmed.match(/^(?:RF-(\d{1,3})|\d+[\.)])\s*[:.\-\s]*(.+)/);
      if (headerMatch) {
        if (currentReq && currentReq.description) {
          requirements.push(this.buildReq(currentReq, agentName, reqIndex++));
        }
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

    if (currentReq && currentReq.description) {
      requirements.push(this.buildReq(currentReq, agentName, reqIndex++));
    }

    // Strategy 3: Fallback
    if (requirements.length === 0) {
      const reqLines = lines.filter((line) => /^[\s]*[-•*\d]/.test(line.trim()) && line.trim().length > 10).slice(0, 10);
      reqLines.forEach((line, i) => {
        const text = line.replace(/^[\s]*[-•*\d.]+\s*/, '').trim().substring(0, 300);
        if (text) {
          requirements.push({
            code: `RF-${String(reqIndex + i + 1).padStart(2, '0')}`,
            name: text.split('.')[0]?.substring(0, 60) || text.substring(0, 60),
            description: text,
            priority: i < 3 ? 'Alta' : i < 6 ? 'Media' : 'Baja',
            agentName,
          });
        }
      });
    }

    return requirements;
  }

  private buildReq(partial: Partial<ParsedRequirement>, agentName: string, index: number): ParsedRequirement {
    return {
      code: `RF-${String(index + 1).padStart(2, '0')}`,
      name: (partial.name || `Requerimiento ${index + 1}`).substring(0, 100),
      description: (partial.description || '').substring(0, 2000),
      priority: partial.priority || 'Media',
      agentName,
    };
  }

  private parseAgentContributions(input: SrdInput): AgentSection[] {
    const sections: AgentSection[] = [];
    let globalReqIndex = 0;

    for (const agent of input.agents) {
      const agentMessages = input.messages.filter((m) => m.agentName === agent.name);
      if (agentMessages.length === 0) continue;

      const combinedContent = agentMessages.map((m) => m.content).join('\n\n');
      const requirements = this.parseRequirements(combinedContent, agent.name, globalReqIndex);
      globalReqIndex += requirements.length;

      const risks: { risk: string; probability: string; impact: string; mitigation: string }[] = [];
      const riskMatches = combinedContent.match(/risk|riesgo|mitigación|mitigation/gi);
      if (riskMatches && riskMatches.length > 0) {
        const riskLines = combinedContent.split('\n').filter((line) =>
          /risk|riesgo/.test(line.toLowerCase()) && line.trim().length > 10
        );
        for (const line of riskLines.slice(0, 5)) {
          risks.push({
            risk: line.substring(0, 200).trim(),
            probability: 'Media',
            impact: 'Alta',
            mitigation: 'Monitoreo y plan de contingencia',
          });
        }
      }
      if (risks.length === 0) {
        risks.push({ risk: 'Complejidad de integración', probability: 'Media', impact: 'Media', mitigation: 'Plan de pruebas exhaustivo' });
      }

      const timeEstimates: { module: string; hours: number }[] = [];
      const timeMatches = combinedContent.match(/(\d+)\s*(hours|hrs|horas|weeks|semanas|months|meses)/gi);
      if (timeMatches) {
        for (const match of timeMatches.slice(0, 5)) {
          const num = parseInt(match.replace(/[^0-9]/g, '')) || 40;
          timeEstimates.push({ module: `${agent.name} - ${agent.division}`, hours: num });
        }
      }
      if (timeEstimates.length === 0) {
        timeEstimates.push({ module: `${agent.division} desarrollo`, hours: 80 });
      }

      sections.push({
        agentName: agent.name,
        role: agent.division,
        requirements,
        risks,
        timeEstimates,
        analysis: combinedContent.substring(0, 2000).trim(),
      });
    }

    return sections;
  }

  private border() {
    return {
      top: { style: BorderStyle.SINGLE, size: 1, color: '7C3AED' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '7C3AED' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '7C3AED' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '7C3AED' },
    };
  }

  private headerCell(text: string, widthPct = 25): TableCell {
    return new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
      })],
      shading: { type: ShadingType.SOLID, color: '7C3AED', fill: '7C3AED' },
      borders: this.border(),
      width: { size: widthPct, type: WidthType.PERCENTAGE },
    });
  }

  private cell(text: string, widthPct = 25, bold = false): TableCell {
    return new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, size: 18, font: 'Calibri', bold })],
        spacing: { before: 80, after: 80 },
      })],
      borders: this.border(),
      width: { size: widthPct, type: WidthType.PERCENTAGE },
    });
  }

  async generateSrd(input: SrdInput): Promise<Blob> {
    const sections = this.parseAgentContributions(input);
    const allReqs = sections.flatMap((s) => s.requirements);
    const children: any[] = [];

    // Title
    children.push(
      new Paragraph({ text: 'DOCUMENTO DE REQUERIMIENTOS DE SOFTWARE', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
      new Paragraph({ text: `Nombre de Proyecto: ${input.projectName}`, spacing: { after: 100 }, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Fecha: ${new Date().toLocaleDateString('es-CR')}`, spacing: { after: 100 }, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Equipo: ${input.agents.filter((a) => input.messages.some((m) => m.agentName === a.name)).map((a) => a.name).join(', ')}`, spacing: { after: 100 }, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Agentes participantes: ${input.agents.filter((a) => input.messages.some((m) => m.agentName === a.name)).length} de ${input.agents.length}`, spacing: { after: 500 }, alignment: AlignmentType.CENTER }),
    );

    // ─── 1. Matrix of Functional Requirements ───
    children.push(new Paragraph({ text: '1. MATRIZ DE REQUERIMIENTOS FUNCIONALES', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
    children.push(new Paragraph({ text: `Nombre de Proyecto: ${input.projectName}`, spacing: { after: 150 } }));

    if (allReqs.length > 0) {
      // Generous column widths: Code=8%, Name=17%, Description=50%, Priority=12%, Agent=13%
      const reqRows: TableRow[] = [
        new TableRow({ children: [
          this.headerCell('Código', 8),
          this.headerCell('Nombre', 17),
          this.headerCell('Descripción', 50),
          this.headerCell('Prioridad', 12),
          this.headerCell('Agente', 13),
        ]}),
      ];

      for (const req of allReqs) {
        reqRows.push(new TableRow({ children: [
          this.cell(req.code, 8, true),
          this.cell(req.name, 17),
          this.cell(req.description, 50),
          this.cell(req.priority, 12, req.priority === 'Alta'),
          this.cell(req.agentName, 13),
        ]}));
      }

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: reqRows,
      }));
    } else {
      children.push(new Paragraph({ text: 'No se detectaron requerimientos detallados en la conversación.', spacing: { after: 100 } }));
    }

    // ─── 2. Non-Functional Requirements ───
    children.push(new Paragraph({ text: '2. REQUERIMIENTOS NO FUNCIONALES', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
    const nfrRows: TableRow[] = [
      new TableRow({ children: [this.headerCell('Requerimiento', 45), this.headerCell('Categoría', 25), this.headerCell('Agente', 30)] }),
    ];
    nfrRows.push(new TableRow({ children: [this.cell('Alta disponibilidad 99.9%', 45), this.cell('Disponibilidad', 25), this.cell('Cloud Architect', 30)] }));
    nfrRows.push(new TableRow({ children: [this.cell('Tiempo de respuesta < 200ms', 45), this.cell('Rendimiento', 25), this.cell('Backend Architect', 30)] }));
    nfrRows.push(new TableRow({ children: [this.cell('Cifrado de datos en tránsito y reposo', 45), this.cell('Seguridad', 25), this.cell('Security Engineer', 30)] }));
    nfrRows.push(new TableRow({ children: [this.cell('WCAG 2.1 AA', 45), this.cell('Accesibilidad', 25), this.cell('UX/UI Designer', 30)] }));
    nfrRows.push(new TableRow({ children: [this.cell('Infraestructura escalable horizontalmente', 45), this.cell('Escalabilidad', 25), this.cell('Cloud Architect', 30)] }));
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: nfrRows }));

    // ─── 3. Risk Analysis ───
    children.push(new Paragraph({ text: '3. ANÁLISIS DE RIESGOS', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
    const riskRows: TableRow[] = [
      new TableRow({ children: [this.headerCell('Riesgo', 35), this.headerCell('Probabilidad', 15), this.headerCell('Impacto', 15), this.headerCell('Mitigación', 35)] }),
    ];
    for (const section of sections) {
      for (const risk of section.risks.slice(0, 2)) {
        riskRows.push(new TableRow({
          children: [this.cell(risk.risk, 35), this.cell(risk.probability, 15), this.cell(risk.impact, 15), this.cell(risk.mitigation, 35)],
        }));
      }
    }
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: riskRows }));

    // ─── 4. Time Estimate ───
    children.push(new Paragraph({ text: '4. ESTIMACIÓN DE TIEMPO', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
    const timeRows: TableRow[] = [
      new TableRow({ children: [this.headerCell('Módulo', 50), this.headerCell('Horas', 25), this.headerCell('Agente', 25)] }),
    ];
    let totalHours = 0;
    for (const section of sections) {
      for (const est of section.timeEstimates.slice(0, 2)) {
        totalHours += est.hours;
        timeRows.push(new TableRow({ children: [this.cell(est.module, 50), this.cell(`${est.hours}h`, 25), this.cell(section.agentName, 25)] }));
      }
    }
    timeRows.push(new TableRow({
      children: [this.headerCell('TOTAL ESTIMADO'), this.headerCell(`${totalHours}h (${Math.ceil(totalHours / 40)} semanas)`), this.headerCell('')],
    }));
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: timeRows }));

    // ─── 5. Análisis por Agente ───
    children.push(new Paragraph({ text: '5. ANÁLISIS POR AGENTE', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
    for (const section of sections) {
      children.push(new Paragraph({ text: `${section.agentName} (${section.role})`, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
      children.push(new Paragraph({ text: section.analysis || 'Análisis pendiente.', spacing: { after: 150 } }));
    }

    // ─── 6. Conclusión ───
    children.push(new Paragraph({ text: '6. CONCLUSIÓN', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
    const totalReqCount = allReqs.length;
    const highPriorityCount = allReqs.filter((r) => r.priority === 'Alta').length;
    const contributingAgents = sections.map((s) => s.agentName).join(', ');
    const totalEstHours = sections.reduce((sum, s) => sum + s.timeEstimates.reduce((t, e) => t + e.hours, 0), 0);
    children.push(
      new Paragraph({ text: `Se identificaron un total de ${totalReqCount} requerimientos funcionales, de los cuales ${highPriorityCount} son de prioridad alta.`, spacing: { after: 100 } }),
      new Paragraph({ text: `Agentes contribuyentes: ${contributingAgents}.`, spacing: { after: 100 } }),
      new Paragraph({ text: `Horas totales estimadas: ${totalEstHours}h (aproximadamente ${Math.ceil(totalEstHours / 40)} semanas de trabajo).`, spacing: { after: 100 } }),
      new Paragraph({ text: `Se recomienda iniciar con los requerimientos de prioridad alta en la primera fase del proyecto, seguido por los de prioridad media en fases posteriores.`, spacing: { after: 200 } }),
    );

    const doc = new Document({
      sections: [{ properties: {}, children }],
    });

    return await Packer.toBlob(doc);
  }
}

export const srdGenerator = new SrdGenerator();