// Pure SVG chart generators — no React dependencies
// These generate base64-encoded SVG data URIs for embedding in documents

export function generateCostBarChart(data: { name: string; cost: number }[]): string {
  const maxCost = Math.max(...data.map((d) => d.cost), 1);
  const barWidth = 40;
  const height = 200;
  const barGap = 12;
  const labelGap = 25;
  const marginLeft = 100;
  
  const colors = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#3b0764'];
  
  let bars = '';
  data.forEach((d, i) => {
    const barH = (d.cost / maxCost) * (height - 30);
    const x = marginLeft + i * (barWidth + barGap);
    const y = height - barH - labelGap;
    bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${colors[i % colors.length]}" />`;
    bars += `<text x="${x + barWidth / 2}" y="${height - 5}" text-anchor="middle" font-size="10" fill="#94a3b8">${d.name.substring(0, 10)}</text>`;
    bars += `<text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="9" fill="#e2e8f0">$${d.cost.toLocaleString()}</text>`;
  });

  const w = marginLeft + data.length * (barWidth + barGap) + 20;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height + 30}" viewBox="0 0 ${w} ${height + 30}">
    <rect width="100%" height="100%" fill="#0f172a" rx="8" />
    <text x="${w / 2}" y="25" text-anchor="middle" font-size="12" fill="#e2e8f0" font-weight="bold">Cost Breakdown by Phase</text>
    ${bars}
  </svg>`;
  
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

export function generateRiskMatrix(risks: { risk: string; probability: string; impact: string }[]): string {
  const cellSize = 55;
  const cols = 3;
  const rows = Math.ceil(risks.length / cols);
  const width = cols * (cellSize + 12) + 30;
  const height = rows * (cellSize + 12) + 50;

  let cells = '';
  risks.forEach((r, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 15 + col * (cellSize + 12);
    const y = 35 + row * (cellSize + 12);
    const imp = r.impact === 'Alta' ? 3 : r.impact === 'Media' ? 2 : 1;
    const prob = r.probability === 'Alta' ? 3 : r.probability === 'Media' ? 2 : 1;
    const sev = imp * prob;
    const color = sev >= 7 ? '#ef4444' : sev >= 4 ? '#f59e0b' : '#22c55e';
    
    cells += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="6" fill="${color}" opacity="0.15" stroke="${color}" stroke-width="1.5" />`;
    cells += `<text x="${x + cellSize / 2}" y="${y + 20}" text-anchor="middle" font-size="9" fill="#e2e8f0">${r.risk.substring(0, 14)}</text>`;
    cells += `<text x="${x + cellSize / 2}" y="${y + 36}" text-anchor="middle" font-size="8" fill="#94a3b8">${r.probability} / ${r.impact}</text>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#0f172a" rx="8" />
    <text x="${width / 2}" y="20" text-anchor="middle" font-size="12" fill="#e2e8f0" font-weight="bold">Risk Matrix</text>
    ${cells}
  </svg>`;
  
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

export function generateBudgetPie(data: { name: string; value: number }[]): string {
  const cx = 120, cy = 130, r = 90;
  const colors = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#6d28d9', '#5b21b6'];
  const total = data.reduce((s, d) => s + d.value, 1);

  let slices = '';
  let angle = -90;
  data.forEach((d, i) => {
    const pct = d.value / total;
    const sweep = pct * 360;
    const a1 = (angle * Math.PI) / 180;
    const a2 = ((angle + sweep) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const la = sweep > 180 ? 1 : 0;
    
    slices += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${la} 1 ${x2} ${y2} Z" fill="${colors[i % colors.length]}" opacity="0.85" stroke="#0f172a" stroke-width="2" />`;
    
    const mid = ((angle + sweep / 2) * Math.PI) / 180;
    slices += `<text x="${cx + r * 0.6 * Math.cos(mid)}" y="${cy + r * 0.6 * Math.sin(mid) + 3}" text-anchor="middle" font-size="9" fill="white" font-weight="bold">${Math.round(pct * 100)}%</text>`;
    angle += sweep;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250" viewBox="0 0 250 250">
    <rect width="100%" height="100%" fill="#0f172a" rx="8" />
    <text x="125" y="22" text-anchor="middle" font-size="12" fill="#e2e8f0" font-weight="bold">Budget Distribution</text>
    ${slices}
  </svg>`;
  
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

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