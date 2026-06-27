import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle } from 'docx';
import type { Agent } from '../types';

interface SrdInput {
  projectName: string;
  agents: Agent[];
  messages: { role: string; content: string; agentName?: string; timestamp: string }[];
}

interface AgentSection {
  agentName: string;
  role: string;
  requirements: string[];
  risks: { risk: string; probability: string; impact: string; mitigation: string }[];
  timeEstimates: { module: string; hours: number }[];
  analysis: string;
}

class SrdGenerator {
  private parseAgentContributions(input: SrdInput): AgentSection[] {
    const sections: AgentSection[] = [];

    for (const agent of input.agents) {
      const agentMessages = input.messages.filter((m) => m.agentName === agent.name);
      if (agentMessages.length === 0) continue;

      // Extract all content from this agent
      const combinedContent = agentMessages.map((m) => m.content).join('\n\n');

      // Parse requirements (lines with "- ", "• ", "1. ", etc.)
      const reqLines = combinedContent.split('\n').filter((line) =>
        /^[\s]*[-•*\d]/.test(line.trim()) && line.trim().length > 5
      );
      const requirements = reqLines.slice(0, 8).map((l) => l.replace(/^[\s]*[-•*\d.]+\s*/, '').trim());

      // Parse risks
      const risks = [];
      const riskMatches = combinedContent.match(/risk|riesgo|mitigación|mitigation/gi);
      if (riskMatches && riskMatches.length > 0) {
        const riskLines = combinedContent.split('\n').filter((line) =>
          /risk|riesgo/.test(line.toLowerCase()) && line.trim().length > 10
        );
        for (const line of riskLines.slice(0, 5)) {
          risks.push({
            risk: line.substring(0, 80).trim(),
            probability: 'Medium',
            impact: 'High',
            mitigation: 'Monitor and address proactively',
          });
        }
      }

      // Parse time estimates
      const timeEstimates: { module: string; hours: number }[] = [];
      const timeMatches = combinedContent.match(/(\d+)\s*(hours|hrs|horas|weeks|semanas|months|meses)/gi);
      if (timeMatches) {
        for (const match of timeMatches.slice(0, 5)) {
          const num = parseInt(match.replace(/[^0-9]/g, '')) || 40;
          timeEstimates.push({
            module: `${agent.name} - ${agent.division} deliverables`,
            hours: num,
          });
        }
      }

      sections.push({
        agentName: agent.name,
        role: agent.division,
        requirements: requirements.length > 0 ? requirements : ['As determined by analysis'],
        risks: risks.length > 0 ? risks : [{ risk: 'Integration complexity', probability: 'Medium', impact: 'Medium', mitigation: 'Thorough testing plan' }],
        timeEstimates: timeEstimates.length > 0 ? timeEstimates : [{ module: `${agent.division} development`, hours: 40 }],
        analysis: combinedContent.substring(0, 500).trim(),
      });
    }

    return sections;
  }

  private createBorder() {
    return {
      top: { style: BorderStyle.SINGLE, size: 1, color: '7C3AED' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '7C3AED' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '7C3AED' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '7C3AED' },
    };
  }

  private createTable(rows: TableRow[]): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
    });
  }

  private headerCell(text: string): TableCell {
    return new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20 })], alignment: AlignmentType.CENTER })],
      shading: { fill: '7C3AED' },
      borders: this.createBorder(),
      width: { size: 25, type: WidthType.PERCENTAGE },
    });
  }

  private cell(text: string): TableCell {
    return new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, size: 18 })], spacing: { before: 40, after: 40 } })],
      borders: this.createBorder(),
      width: { size: 25, type: WidthType.PERCENTAGE },
    });
  }

  async generateSrd(input: SrdInput): Promise<Blob> {
    const sections = this.parseAgentContributions(input);

    // --- Build document ---
    const children: any[] = [];

    // Title
    children.push(
      new Paragraph({
        text: 'REQUERIMIENTOS DE SOFTWARE',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );

    // Metadata
    children.push(
      new Paragraph({ text: `Proyecto: ${input.projectName}`, spacing: { after: 80 } }),
      new Paragraph({ text: `Fecha: ${new Date().toLocaleDateString('es-CR')}`, spacing: { after: 80 } }),
      new Paragraph({ text: `Equipo: ${input.agents.map((a) => a.name).join(', ')}`, spacing: { after: 80 } }),
      new Paragraph({ text: `Agentes participantes: ${input.agents.length}`, spacing: { after: 200 } })
    );

    // 1. Functional Requirements
    children.push(new Paragraph({ text: '1. REQUERIMIENTOS FUNCIONALES', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 150 } }));

    const funcReqRows: TableRow[] = [
      new TableRow({ children: [this.headerCell('Requerimiento'), this.headerCell('Prioridad'), this.headerCell('Agente')] }),
    ];

    for (const section of sections) {
      for (const req of section.requirements.slice(0, 3)) {
        funcReqRows.push(
          new TableRow({
            children: [this.cell(req), this.cell('Alta'), this.cell(section.agentName)],
          })
        );
      }
    }
    children.push(this.createTable(funcReqRows));

    // 2. Non-Functional Requirements
    children.push(new Paragraph({ text: '2. REQUERIMIENTOS NO FUNCIONALES', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 150 } }));

    const nfrRows: TableRow[] = [
      new TableRow({ children: [this.headerCell('Requerimiento'), this.headerCell('Categoría'), this.headerCell('Agente')] }),
    ];
    nfrRows.push(new TableRow({ children: [this.cell('Alta disponibilidad 99.9%'), this.cell('Disponibilidad'), this.cell('Cloud Architect')] }));
    nfrRows.push(new TableRow({ children: [this.cell('Tiempo de respuesta < 200ms'), this.cell('Rendimiento'), this.cell('Backend Architect')] }));
    nfrRows.push(new TableRow({ children: [this.cell('Cifrado de datos en tránsito'), this.cell('Seguridad'), this.cell('Security Engineer')] }));
    nfrRows.push(new TableRow({ children: [this.cell('WCAG 2.1 AA'), this.cell('Accesibilidad'), this.cell('UX/UI Designer')] }));
    children.push(this.createTable(nfrRows));

    // 3. Risk Analysis
    children.push(new Paragraph({ text: '3. ANÁLISIS DE RIESGOS', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 150 } }));

    const riskRows: TableRow[] = [
      new TableRow({ children: [this.headerCell('Riesgo'), this.headerCell('Probabilidad'), this.headerCell('Impacto'), this.headerCell('Mitigación')] }),
    ];

    for (const section of sections) {
      for (const risk of section.risks.slice(0, 2)) {
        riskRows.push(
          new TableRow({
            children: [this.cell(risk.risk), this.cell(risk.probability), this.cell(risk.impact), this.cell(risk.mitigation)],
          })
        );
      }
    }
    children.push(this.createTable(riskRows));

    // 4. Time Estimate
    children.push(new Paragraph({ text: '4. ESTIMACIÓN DE TIEMPO', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 150 } }));

    const timeRows: TableRow[] = [
      new TableRow({ children: [this.headerCell('Módulo'), this.headerCell('Horas'), this.headerCell('Agente')] }),
    ];

    let totalHours = 0;
    for (const section of sections) {
      for (const est of section.timeEstimates.slice(0, 2)) {
        totalHours += est.hours;
        timeRows.push(
          new TableRow({
            children: [this.cell(est.module), this.cell(`${est.hours}h`), this.cell(section.agentName)],
          })
        );
      }
    }
    timeRows.push(
      new TableRow({
        children: [
          this.headerCell('TOTAL ESTIMADO'),
          this.headerCell(`${totalHours}h (${Math.ceil(totalHours / 40)} semanas)`),
          this.headerCell(''),
        ],
      })
    );
    children.push(this.createTable(timeRows));

    // 5. Agent Analysis
    children.push(new Paragraph({ text: '5. ANÁLISIS POR AGENTE', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 150 } }));

    for (const section of sections) {
      children.push(new Paragraph({ text: `${section.agentName} (${section.role})`, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
      children.push(new Paragraph({ text: section.analysis || 'Análisis pendiente.', spacing: { after: 150 } }));
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    return await Packer.toBlob(doc);
  }
}

export const srdGenerator = new SrdGenerator();