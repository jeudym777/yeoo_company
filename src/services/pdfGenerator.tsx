import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from '@react-pdf/renderer';

// Register fonts for better rendering
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvBg.ttf', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#7c3aed',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  divider: {
    height: 2,
    backgroundColor: '#7c3aed',
    marginTop: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1e293b',
    marginTop: 20,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottom: '1px solid #cbd5e1',
  },
  bodyText: {
    fontSize: 10.5,
    color: '#334155',
    lineHeight: 1.7,
    marginBottom: 8,
  },
  table: {
    marginTop: 10,
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottom: '2px solid #94a3b8',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '1px solid #e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#fafbfc',
  },
  tableHeaderCell: {
    fontSize: 9.5,
    fontWeight: 700,
    color: '#475569',
    flex: 1,
  },
  tableCell: {
    fontSize: 9.5,
    color: '#334155',
    flex: 1,
    lineHeight: 1.5,
  },
  tableCellWide: {
    fontSize: 9.5,
    color: '#334155',
    flex: 2,
    lineHeight: 1.5,
  },
  tableCellNarrow: {
    fontSize: 9.5,
    color: '#334155',
    flex: 0.5,
    lineHeight: 1.5,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
    borderTop: '1px solid #e2e8f0',
    paddingTop: 8,
  },
  agentSection: {
    marginBottom: 16,
    paddingLeft: 12,
    borderLeft: '3px solid #a78bfa',
  },
  agentName: {
    fontSize: 12,
    fontWeight: 700,
    color: '#5b21b6',
    marginBottom: 4,
  },
  label: {
    fontSize: 9.5,
    fontWeight: 700,
    color: '#64748b',
    marginTop: 6,
    marginBottom: 2,
  },
  metricBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    border: '1px solid #e2e8f0',
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 700,
    color: '#7c3aed',
  },
  metricLabel: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 2,
  },
});

interface AgentOutput {
  name: string;
  role: string;
  output: string;
}

interface ExecutiveReportPDFProps {
  projectName: string;
  reportText: string;
  agentOutputs: AgentOutput[];
  totalMessages: number;
}

const ExecutiveReportDocument: React.FC<ExecutiveReportPDFProps> = ({
  projectName,
  reportText,
  agentOutputs,
  totalMessages,
}) => {
  // Parse report sections (split by headers)
  const sections = reportText.split(/(?=^#{1,3}\s)/m).filter(Boolean);

  // Try to extract table-like data from the report
  const parseTableRows = (text: string): string[][] => {
    const rows: string[][] = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && !trimmed.includes('---')) {
        const cells = trimmed
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        if (cells.length >= 2) rows.push(cells);
      }
    }
    return rows;
  };

  const truncatedProjectName = projectName.length > 50 ? projectName.substring(0, 47) + '...' : projectName;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>YEOO OS — Executive Report</Text>
          <Text style={styles.subtitle}>Project: {truncatedProjectName}</Text>
          <Text style={styles.subtitle}>
            Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
          <View style={styles.divider} />
        </View>

        {/* Metrics */}
        <View style={styles.metricBox}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{agentOutputs.length}</Text>
            <Text style={styles.metricLabel}>Contributing Agents</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{totalMessages}</Text>
            <Text style={styles.metricLabel}>Total Messages</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{sections.length}</Text>
            <Text style={styles.metricLabel}>Report Sections</Text>
          </View>
        </View>

        {/* Agent Contributions Summary */}
        <Text style={styles.sectionTitle}>Agent Contributions</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCellNarrow}>#</Text>
            <Text style={styles.tableCell}>Agent</Text>
            <Text style={styles.tableCell}>Division</Text>
            <Text style={styles.tableCellWide}>Key Insights</Text>
          </View>
          {agentOutputs.map((agent, idx) => {
            const summary = agent.output.length > 200
              ? agent.output.substring(0, 197) + '...'
              : agent.output;
            return (
              <View key={agent.name} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.tableCellNarrow}>{idx + 1}</Text>
                <Text style={styles.tableCell}>{agent.name}</Text>
                <Text style={styles.tableCell}>{agent.role}</Text>
                <Text style={styles.tableCellWide}>{summary}</Text>
              </View>
            );
          })}
        </View>

        {/* Report Sections */}
        {sections.map((section, idx) => {
          const lines = section.trim().split('\n');
          const heading = lines[0].replace(/^#+\s*/, '');
          const body = lines.slice(1).join('\n').trim();
          const tableRows = parseTableRows(section);

          return (
            <View key={idx} wrap={false}>
              <Text style={styles.sectionTitle}>{heading}</Text>

              {/* Render markdown-like tables */}
              {tableRows.length > 0 && tableRows[0].length >= 2 ? (
                <View style={styles.table}>
                  {/* Header row (first row) */}
                  <View style={styles.tableHeader}>
                    {tableRows[0].map((cell, ci) => (
                      <Text
                        key={ci}
                        style={ci === 0 ? styles.tableCell : styles.tableCellWide}
                      >
                        {cell}
                      </Text>
                    ))}
                  </View>
                  {/* Data rows */}
                  {tableRows.slice(1).map((row, ri) => (
                    <View key={ri} style={ri % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                      {row.map((cell, ci) => (
                        <Text
                          key={ci}
                          style={ci === 0 ? styles.tableCell : styles.tableCellWide}
                        >
                          {cell}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              ) : (
                body.split('\n').map((line, li) => (
                  <Text key={li} style={styles.bodyText}>
                    {line.trim()}
                  </Text>
                ))
              )}
            </View>
          );
        })}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>YEOO OS Executive Report — Generated by CompanyAgent</Text>
          <Text>Page 1</Text>
        </View>
      </Page>
    </Document>
  );
};

// --- Public API ---

export async function generateExecutivePDF(props: ExecutiveReportPDFProps): Promise<Blob> {
  const blob = await pdf(
    <ExecutiveReportDocument {...props} />
  ).toBlob();
  return blob;
}

export function downloadExecutivePDF(props: ExecutiveReportPDFProps): void {
  generateExecutivePDF(props).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `executive-report-${new Date().toISOString().split('T')[0]}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  });
}