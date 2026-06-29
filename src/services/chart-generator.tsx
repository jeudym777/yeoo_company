// Generates a cost breakdown bar chart as base64 PNG
export function generateCostBarChart(data: { name: string; cost: number }[]): string {
  // For .docx insertion we need actual base64, so we use a lightweight approach:
  // Return a simple SVG data URI that can be embedded
  const maxCost = Math.max(...data.map((d) => d.cost), 1);
  const barWidth = 40;
  const height = 200;
  const barGap = 12;
  const labelGap = 25;
  const marginLeft = 100;
  
  const colors = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#3b0764'];
  
  let bars = '';
  let labels = '';
  data.forEach((d, i) => {
    const barH = (d.cost / maxCost) * (height - 30);
    const x = marginLeft + i * (barWidth + barGap);
    const y = height - barH - labelGap;
    bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${colors[i % colors.length]}" />`;
    bars += `<text x="${x + barWidth / 2}" y="${height - 5}" text-anchor="middle" font-size="10" fill="#94a3b8">${d.name}</text>`;
    bars += `<text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="9" fill="#e2e8f0">$${d.cost.toLocaleString()}</text>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${marginLeft + data.length * (barWidth + barGap) + 20}" height="${height + 20}" viewBox="0 0 ${marginLeft + data.length * (barWidth + barGap) + 20} ${height + 20}">
    <rect width="100%" height="100%" fill="#0f172a" rx="8" />
    <text x="${marginLeft / 2}" y="25" text-anchor="middle" font-size="11" fill="#e2e8f0" font-weight="bold">Costos por Fase</text>
    ${bars}
  </svg>`;
  
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

// Generates a risk matrix as SVG
export function generateRiskMatrix(risks: { risk: string; probability: string; impact: string }[]): string {
  const cellSize = 50;
  const cols = 3;
  const rows = Math.ceil(risks.length / cols);
  const width = cols * (cellSize + 10) + 40;
  const height = rows * (cellSize + 10) + 60;

  let cells = '';
  risks.forEach((r, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 20 + col * (cellSize + 10);
    const y = 40 + row * (cellSize + 10);
    const impactScore = r.impact === 'Alta' ? 3 : r.impact === 'Media' ? 2 : 1;
    const probScore = r.probability === 'Alta' ? 3 : r.probability === 'Media' ? 2 : 1;
    const severity = impactScore * probScore;
    const color = severity >= 7 ? '#ef4444' : severity >= 4 ? '#f59e0b' : '#22c55e';
    
    cells += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="6" fill="${color}" opacity="0.2" stroke="${color}" stroke-width="1.5" />`;
    cells += `<text x="${x + cellSize / 2}" y="${y + 18}" text-anchor="middle" font-size="8" fill="#e2e8f0">${r.risk.substring(0, 12)}</text>`;
    cells += `<text x="${x + cellSize / 2}" y="${y + 32}" text-anchor="middle" font-size="7" fill="#94a3b8">${r.probability}/${r.impact}</text>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#0f172a" rx="8" />
    <text x="${width / 2}" y="22" text-anchor="middle" font-size="11" fill="#e2e8f0" font-weight="bold">Matriz de Riesgos</text>
    ${cells}
  </svg>`;
  
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

// Generates a simple pie chart for budget distribution
export function generateBudgetPie(data: { name: string; value: number }[]): string {
  const cx = 120;
  const cy = 120;
  const outerR = 90;
  const colors = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#6d28d9'];
  const total = data.reduce((s, d) => s + d.value, 1);

  let slices = '';
  let angle = -90;
  data.forEach((d, i) => {
    const pct = d.value / total;
    const sweep = pct * 360;
    const startAngle = (angle * Math.PI) / 180;
    const endAngle = ((angle + sweep) * Math.PI) / 180;
    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);
    const largeArc = sweep > 180 ? 1 : 0;
    const color = colors[i % colors.length];
    
    slices += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}" opacity="0.85" stroke="#0f172a" stroke-width="1" />`;
    
    // Label at mid-angle
    const midAngle = ((angle + sweep / 2) * Math.PI) / 180;
    const lx = cx + (outerR * 0.6) * Math.cos(midAngle);
    const ly = cy + (outerR * 0.6) * Math.sin(midAngle);
    slices += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="9" fill="white" font-weight="bold">${Math.round(pct * 100)}%</text>`;
    
    angle += sweep;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250" viewBox="0 0 250 250">
    <rect width="100%" height="100%" fill="#0f172a" rx="8" />
    <text x="125" y="20" text-anchor="middle" font-size="11" fill="#e2e8f0" font-weight="bold">Distribución Presupuesto</text>
    ${slices}
  </svg>`;
  
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

// Parse cost data from agent sections
export function parseCostData(agentOutputs: { name: string; role: string; output: string }[]): { name: string; cost: number }[] {
  const data: { name: string; cost: number }[] = [];
  for (const a of agentOutputs) {
    const matches = a.output.match(/\$?(\d{2,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:k|K|mil|thousand|USD)?/g);
    if (matches) {
      let total = 0;
      for (const m of matches) {
        const num = parseFloat(m.replace(/[$,kK]/g, '')) * (m.includes('k') || m.includes('K') ? 1000 : 1);
        if (num > 0 && num < 10000000) total += num;
      }
      if (total > 0) data.push({ name: a.name.split(' ')[0], cost: total });
    }
  }
  return data;
}