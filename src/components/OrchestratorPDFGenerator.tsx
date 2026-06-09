import React from 'react';
import jsPDF from 'jspdf';
import type { Agent } from '../types';

interface OrchestratorPDFGeneratorProps {
  orchestratorResult: {
    agent: Agent;
    input: string;
    output: string;
    status: string;
  };
  agentResults: Array<{
    agent: Agent;
    input: string;
    output: string;
    status: string;
  }>;
  userInput: string;
}

export const OrchestratorPDFGenerator: React.FC<OrchestratorPDFGeneratorProps> = ({
  orchestratorResult,
  agentResults,
  userInput,
}) => {
  // Helper to format text output and detect markdown tables
  const formatText = (text: string) => {
    const lines = text.split('\n');
    return lines.filter(line => line.trim().length > 0);
  };

  // Helper to detect and parse markdown tables
  const parseMarkdownTable = (text: string) => {
    const tableRegex = /\|(.+)\|/g;
    const lines = text.split('\n');
    const tableLines = [];
    let inTable = false;

    for (const line of lines) {
      if (tableRegex.test(line)) {
        inTable = true;
        const cells = line
          .split('|')
          .filter(cell => cell.trim().length > 0)
          .map(cell => cell.trim());
        tableLines.push(cells);
      } else if (inTable && line.trim().length === 0) {
        inTable = false;
      }
    }

    return tableLines.length > 0 ? tableLines : null;
  };

  // Helper to add page break if needed
  const checkPageBreak = (pdf: jsPDF, yPos: number, buffer: number = 30) => {
    const pageHeight = pdf.internal.pageSize.getHeight();
    if (yPos > pageHeight - buffer) {
      pdf.addPage();
      return 20;
    }
    return yPos;
  };

  // Helper to add section header
  const addSectionHeader = (pdf: jsPDF, yPos: number, title: string, emoji: string = '') => {
    pdf.setTextColor(102, 51, 153); // Purple
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    const headerText = emoji ? `${emoji} ${title}` : title;
    pdf.text(headerText, 20, yPos);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'normal');
    return yPos + 8;
  };

  // Helper to add formatted paragraph text with table support
  const addFormattedText = (pdf: jsPDF, yPos: number, content: string, pageWidth: number = 170) => {
    const lines = formatText(content);
    const pageHeight = pdf.internal.pageSize.getHeight();
    let currentY = yPos;
    let i = 0;

    while (i < lines.length) {
      // Check if this line starts a table
      const tableLines = [];
      let j = i;
      while (j < lines.length && lines[j].includes('|')) {
        tableLines.push(lines[j]);
        j++;
      }

      if (tableLines.length > 1) {
        // Parse and render markdown table
        const cells = tableLines.map(line =>
          line
            .split('|')
            .filter(cell => cell.trim().length > 0)
            .map(cell => cell.trim())
        );

        if (cells[0].length > 0) {
          currentY = checkPageBreak(pdf, currentY, 40);

          // Render table header
          pdf.setFillColor(102, 51, 153);
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(8);

          const colWidth = (pageWidth - 40) / cells[0].length;
          cells[0].forEach((header, colIndex) => {
            pdf.text(header, 20 + colIndex * colWidth + 2, currentY, { maxWidth: colWidth - 4 });
          });
          currentY += 6;

          // Render table rows
          pdf.setTextColor(0, 0, 0);
          let rowIndex = 1;
          for (; rowIndex < cells.length; rowIndex++) {
            if (currentY > pageHeight - 30) {
              pdf.addPage();
              currentY = 20;
            }

            if (rowIndex % 2 === 0) {
              pdf.setFillColor(240, 240, 250);
              pdf.rect(20, currentY - 3, pageWidth - 40, 6, 'F');
            }

            cells[rowIndex].forEach((cell, colIndex) => {
              pdf.text(cell, 20 + colIndex * colWidth + 2, currentY, { maxWidth: colWidth - 4 });
            });
            currentY += 6;
          }

          currentY += 4;
          i = j;
        } else {
          i++;
        }
      } else {
        // Regular text
        const line = lines[i];
        const wrappedLines = pdf.splitTextToSize(line.trim(), pageWidth - 40);

        wrappedLines.forEach((wrappedLine: string) => {
          currentY = checkPageBreak(pdf, currentY, 30);
          pdf.text(wrappedLine, 20, currentY);
          currentY += 5;
        });

        currentY += 3;
        i++;
      }
    }

    return currentY;
  };

  const generatePDF = async () => {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 20;

      // Add header
      pdf.setFillColor(102, 51, 153);
      pdf.rect(0, 0, pageWidth, 25, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.text('YEOO SOFTWARE', pageWidth / 2, 12, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text('AI Agent Orchestrator - Complete Analysis Report', pageWidth / 2, 20, { align: 'center' });

      pdf.setTextColor(0, 0, 0);
      yPosition = 35;

      // Metadata section
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'bold');
      pdf.text('Analysis Summary', 20, yPosition);
      yPosition += 8;

      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(9);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, yPosition);
      yPosition += 6;
      pdf.text(`Total Agents: ${agentResults.length}`, 20, yPosition);
      yPosition += 6;
      pdf.text(`Analysis Mode: Sequential with Orchestrator Discussion`, 20, yPosition);
      yPosition += 12;

      // User Input section
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'bold');
      pdf.text('User Query', 20, yPosition);
      yPosition += 6;

      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(9);
      pdf.setFillColor(240, 240, 250);
      pdf.rect(20, yPosition - 2, pageWidth - 40, 20, 'F');
      const wrappedInput = pdf.splitTextToSize(userInput, pageWidth - 50);
      pdf.text(wrappedInput, 25, yPosition + 2);
      yPosition += Math.max(20, wrappedInput.length * 5) + 10;

      // Agents Participated table
      yPosition = checkPageBreak(pdf, yPosition, 50);
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'bold');
      pdf.text('Agents Participated', 20, yPosition);
      yPosition += 8;

      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(8);

      // Table header
      pdf.setFillColor(102, 51, 153);
      pdf.setTextColor(255, 255, 255);
      pdf.rect(20, yPosition - 3, pageWidth - 40, 6, 'F');
      pdf.text('Agent', 25, yPosition);
      pdf.text('Division', 90, yPosition);
      pdf.text('Status', 150, yPosition);

      yPosition += 8;
      pdf.setTextColor(0, 0, 0);

      // Table rows
      let rowCount = 0;
      agentResults.forEach((result) => {
        yPosition = checkPageBreak(pdf, yPosition, 30);

        if (rowCount % 2 === 0) {
          pdf.setFillColor(250, 250, 255);
          pdf.rect(20, yPosition - 3, pageWidth - 40, 6, 'F');
        }

        pdf.text(result.agent.name, 25, yPosition);
        pdf.text(result.agent.division, 90, yPosition);
        pdf.text('[Completed]', 150, yPosition);

        yPosition += 7;
        rowCount++;
      });

      // Individual Agent Analyses
      yPosition += 8;
      yPosition = checkPageBreak(pdf, yPosition, 20);

      pdf.setFillColor(102, 51, 153);
      pdf.rect(0, yPosition - 8, pageWidth, 12, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.text('Individual Agent Analyses', 20, yPosition);
      pdf.setTextColor(0, 0, 0);
      
      yPosition += 10;

      // Add each agent's analysis
      agentResults.forEach((result, index) => {
        yPosition = checkPageBreak(pdf, yPosition, 20);

        // Agent header with divider
        pdf.setTextColor(102, 51, 153);
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.text(`Agent ${index + 1}: ${result.agent.name} [${result.agent.division}]`, 20, yPosition);
        
        pdf.setDrawColor(200, 200, 200);
        pdf.line(20, yPosition + 1, pageWidth - 20, yPosition + 1);
        yPosition += 6;

        // Agent output
        pdf.setTextColor(0, 0, 0);
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(9);
        yPosition = addFormattedText(pdf, yPosition, result.output, pageWidth);
        
        yPosition += 4;
      });

      // Final Orchestrator Analysis
      yPosition = checkPageBreak(pdf, yPosition, 30);

      pdf.setFillColor(102, 51, 153);
      pdf.rect(0, yPosition - 8, pageWidth, 12, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.text('ORCHESTRATOR - Final Synthesis', 20, yPosition);
      pdf.setTextColor(0, 0, 0);
      
      yPosition += 10;
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(9);
      yPosition = addFormattedText(pdf, yPosition, orchestratorResult.output, pageWidth);

      // Footer on each page
      const totalPages = (pdf as any).internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
        pdf.text(
          'YEOO SOFTWARE - AI Agent Orchestrator',
          pageWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        );
      }

      const timestamp = new Date().toISOString().split('T')[0];
      pdf.save(`orchestrator-complete-analysis-${timestamp}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error al generar PDF');
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={generatePDF}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 19l9 2-9-18-9 18 9-2m0 0v-8m0 8l-4-2m4 2l4-2"
          />
        </svg>
        Descargar Análisis Completo en PDF (Todos los Agentes + Orchestrator)
      </button>
    </div>
  );
};
