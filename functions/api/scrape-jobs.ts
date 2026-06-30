// Cloudflare Pages Function — Real web scraper for job sites
// Runs server-side (no CORS issues), free tier: 100k req/day
// Route: POST /api/scrape-jobs

interface ScrapeRequest {
  keywords: string;
  country: string;
  sources?: string[]; // ['indeed', 'computrabajo', 'linkedin', 'empresas_cr', 'adzuna']
  max_results?: number;
}

interface ScrapedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  url: string;
  source: string;
  published: string;
  skills: string[];
}

// Costa Rican tech companies with careers pages
const CR_TECH_COMPANIES = [
  { name: 'Microsoft Costa Rica', url: 'https://careers.microsoft.com/us/en/search-results?keywords=&location=Costa%20Rica' },
  { name: 'Intel Costa Rica', url: 'https://jobs.intel.com/en/search-jobs/Costa%20Rica' },
  { name: 'Amazon Costa Rica', url: 'https://www.amazon.jobs/en/search?base_query=costa+rica' },
  { name: 'Konrad Group', url: 'https://www.konrad.com/careers' },
  { name: 'Equifax Costa Rica', url: 'https://careers.equifax.com/jobs/?l=Costa+Rica' },
  { name: 'IBM Costa Rica', url: 'https://www.ibm.com/careers/us-en/search/?filters=country:CR' },
  { name: 'Accenture Costa Rica', url: 'https://www.accenture.com/cr-es/careers' },
  { name: 'Hangar Worldwide', url: 'https://www.hangarww.com/careers' },
  { name: 'Gorilla Logic', url: 'https://gorillalogic.com/careers' },
  { name: 'Growth Acceleration Partners', url: 'https://www.wearegap.com/careers' },
  { name: 'Critical Mass', url: 'https://www.criticalmass.com/join/careers' },
  { name: 'Avantica Technologies', url: 'https://www.avanticatechnologies.com/careers' },
  { name: 'Pernix', url: 'https://www.pernix-solutions.com/careers' },
  { name: 'ZyraTech', url: 'https://www.zyratech.com/careers' },
  { name: 'Tek Experts', url: 'https://www.tek-experts.com/careers' },
  { name: 'Prodigious LATAM', url: 'https://www.prodigious.com/careers' },
  { name: 'BairesDev', url: 'https://www.bairesdev.com/careers/' },
  { name: 'Modus Create', url: 'https://moduscreate.com/careers' },
  { name: '3M Costa Rica', url: 'https://www.3m.com/3M/en_US/careers-us/' },
  { name: 'DXC Technology CR', url: 'https://www.dxc.com/us/en/careers' },
];

function generateId(title: string, source: string): string {
  return `${source}-${title.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 40)}-${Date.now().toString(36)}`;
}

function extractText(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match ? match[1]?.trim() || '' : '';
}

function cleanHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractSalary(text: string): string {
  const patterns = [
    /(\$[\d,]+\s*(?:-\s*\$[\d,]+)?(?:\s*(?:USD|año|por año|anual))?)/i,
    /(?:salario|sueldo)[^\d]*(\$?[\d,]+\s*(?:-\s*[\d,]+)?\s*(?:USD|por año|anual|por mes)?)/i,
    /(?:₡|CRC)\s*([\d.,]+)\s*(?:-\s*([\d.,]+))?/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return '';
}

/**
 * Scrape Indeed (public search, no login needed)
 */
async function scrapeIndeed(keywords: string, country: string): Promise<ScrapedJob[]> {
  const results: ScrapedJob[] = [];
  const locMap: Record<string, string> = { us: 'United+States', cr: 'Costa+Rica', mx: 'Mexico' };
  const location = locMap[country] || 'United+States';
  const query = encodeURIComponent(keywords || 'software engineer');

  try {
    const url = `https://www.indeed.com/jobs?q=${query}&l=${location}&fromage=3&limit=10`;
    console.log(`Scraping Indeed: ${url}`);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!res.ok) {
      console.warn(`Indeed returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    
    // Parse Indeed's job cards
    const cardRegex = /class="[^"]*job_seen_beacon[^"]*"[\s\S]*?<\/table>/gi;
    const cards = html.match(cardRegex) || [];
    
    for (const card of cards.slice(0, 10)) {
      const title = extractText(card, /title="([^"]+)"/) || extractText(card, /class="[^"]*jcs-JobTitle[^"]*"[^>]*>([^<]+)</i);
      const company = extractText(card, /class="[^"]*companyName[^"]*"[^>]*>([^<]+)</);
      const loc = extractText(card, /class="[^"]*companyLocation[^"]*"[^>]*>([^<]+)</);
      const desc = cleanHtml(card).substring(0, 500);
      const salary = extractSalary(card);
      
      if (title && company) {
        results.push({
          id: generateId(title, 'indeed'),
          title,
          company,
          location: loc || location.replace('+', ' '),
          salary,
          description: desc,
          url: `https://www.indeed.com/viewjob?jk=${title.replace(/ /g, '-')}`,
          source: 'indeed',
          published: new Date().toISOString().split('T')[0],
          skills: [],
        });
      }
    }
  } catch (err) {
    console.warn('Indeed scrape error:', err);
  }

  return results;
}

/**
 * Scrape Computrabajo (very simple HTML structure)
 */
async function scrapeComputrabajo(keywords: string, country: string): Promise<ScrapedJob[]> {
  const results: ScrapedJob[] = [];
  const countryMap: Record<string, string> = { cr: 'costa-rica', mx: 'mexico', us: 'estados-unidos', co: 'colombia', pe: 'peru', ar: 'argentina', cl: 'chile' };
  const countrySlug = countryMap[country] || 'costa-rica';
  const query = encodeURIComponent(keywords || 'desarrollador');

  try {
    const url = `https://www.computrabajo.com/${countrySlug}/buscar?q=${query}&r=true`;
    console.log(`Scraping Computrabajo: ${url}`);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    if (!res.ok) {
      console.warn(`Computrabajo returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    
    // Parse Computrabajo job cards
    const cardRegex = /class="[^"]*mt10[^"]*"[^>]*>[\s\S]*?<\/article>/gi;
    const cards = html.match(cardRegex) || [];
    
    for (const card of cards.slice(0, 10)) {
      const title = extractText(card, /class="[^"]*t1[^"]*[^"]*"[^>]*>([^<]+)</i) || extractText(card, /<h[12][^>]*>([^<]+)</i);
      const company = extractText(card, /class="[^"]*dIB[^"]*"[^>]*>([^<]+)</);
      const loc = extractText(card, /class="[^"]*tag[^"]*"[^>]*>([^<]+)</);
      const desc = cleanHtml(card).substring(0, 500);
      const salary = extractSalary(card);
      const link = extractText(card, /href="([^"]+)"/);
      
      if (title && company) {
        results.push({
          id: generateId(title, 'computrabajo'),
          title,
          company,
          location: loc || countrySlug.replace('-', ' ').toUpperCase(),
          salary,
          description: desc,
          url: link?.startsWith('/') ? `https://www.computrabajo.com${link}` : (link || url),
          source: 'computrabajo',
          published: new Date().toISOString().split('T')[0],
          skills: [],
        });
      }
    }
  } catch (err) {
    console.warn('Computrabajo scrape error:', err);
  }

  return results;
}

/**
 * Attempt LinkedIn public search (limited without login, but RSS-like pages exist)
 */
async function scrapeLinkedIn(keywords: string, country: string): Promise<ScrapedJob[]> {
  const results: ScrapedJob[] = [];
  const countryMap: Record<string, string> = { cr: '102782779', us: '1', mx: '36' };
  const geoId = countryMap[country] || '1';

  try {
    // LinkedIn public jobs page
    const query = encodeURIComponent(keywords || 'software engineer');
    const url = `https://www.linkedin.com/jobs/search?keywords=${query}&locationId=${geoId}`;
    console.log(`Scraping LinkedIn: ${url}`);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    if (!res.ok) {
      console.warn(`LinkedIn returned ${res.status} — may require auth`);
      return [];
    }

    const html = await res.text();
    
    // LinkedIn embeds job data in JSON script tags
    const jsonMatch = html.match(/<code[^>]*id="decoratedJobPostingsTurboCluster[^"]*"[^>]*>([\s\S]*?)<\/code>/i);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1].replace(/"/g, '"'));
        // Parse extracted JSON (simplified)
        for (const item of (data?.included || []).slice(0, 10)) {
          if (item?.title) {
            results.push({
              id: generateId(item.title, 'linkedin'),
              title: item.title || '',
              company: item.companyName || item.subtitle || 'Company',
              location: item.location || '',
              salary: '',
              description: (item.description || '').substring(0, 500),
              url: item.url || '',
              source: 'linkedin',
              published: new Date().toISOString().split('T')[0],
              skills: [],
            });
          }
        }
      } catch { /* LinkedIn parsing fallback */ }
    }

    // Fallback: simple text extraction
    if (results.length === 0) {
      const titleMatches = html.match(/class="[^"]*base-search-card__title[^"]*"[^>]*>([^<]+)</gi) || [];
      titles: for (const m of titleMatches.slice(0, 10)) {
        const title = cleanHtml(m);
        if (title && title.length > 5) {
          results.push({
            id: generateId(title, 'linkedin'),
            title,
            company: 'View on LinkedIn',
            location: '',
            salary: '',
            description: 'Visit LinkedIn for full details',
            url: url,
            source: 'linkedin',
            published: new Date().toISOString().split('T')[0],
            skills: [],
          });
        }
      }
    }
  } catch (err) {
    console.warn('LinkedIn scrape error:', err);
  }

  return results;
}

/**
 * Search careers pages of Costa Rican tech companies
 */
async function scrapeCREmpresas(keywords: string): Promise<ScrapedJob[]> {
  const results: ScrapedJob[] = [];
  const lowerKeywords = keywords.toLowerCase();
  
  // Search relevant company pages
  const relevantCompanies = CR_TECH_COMPANIES.filter((c) => {
    const nameLower = c.name.toLowerCase();
    return !keywords || 
      nameLower.includes(lowerKeywords) || 
      ['software', 'develop', 'engineer', 'full', 'stack', 'front', 'back', 'data', 'cloud', 'devops', 'python', 'react', 'node'].some((k) => lowerKeywords.includes(k));
  });

  for (const company of relevantCompanies) {
    try {
      const res = await fetch(company.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(`${company.name}: ${res.status}`);
        continue;
      }

      const html = await res.text();
      const bodyText = cleanHtml(html).substring(0, 5000);
      const hasKeywords = ['engineer', 'developer', 'software', 'data scientist', 'programmer', 'analyst', 'architect', 'full stack', 'frontend', 'backend', 'cloud', 'devops', 'qa', 'support', 'security', 'ml', 'ai'].some((k) => bodyText.toLowerCase().includes(k));

      if (hasKeywords) {
        results.push({
          id: generateId(company.name, 'empresas_cr'),
          title: `Software Developer - ${company.name}`,
          company: company.name,
          location: 'Costa Rica',
          salary: '',
          description: `Company has open positions. Visit their careers page: ${company.url}`,
          url: company.url,
          source: 'empresas_cr',
          published: new Date().toISOString().split('T')[0],
          skills: [],
        });
      }
    } catch (err) {
      console.warn(`${company.name} scrape error:`, err);
    }
  }

  return results;
}

/**
 * Main handler: routes to scrapers based on requested sources
 */
export async function onRequestPost(context: any) {
  const { request } = context;
  const body: ScrapeRequest = await request.json().catch(() => ({}));

  const keywords = body.keywords || 'software engineer';
  const country = body.country || 'cr';
  const sources = body.sources || ['indeed', 'computrabajo', 'linkedin', 'empresas_cr'];
  const maxResults = body.max_results || 30;

  let allResults: ScrapedJob[] = [];

  // Run all requested scrapers in parallel
  const tasks: Promise<ScrapedJob[]>[] = [];

  if (sources.includes('indeed')) tasks.push(scrapeIndeed(keywords, country));
  if (sources.includes('computrabajo')) tasks.push(scrapeComputrabajo(keywords, country));
  if (sources.includes('linkedin')) tasks.push(scrapeLinkedIn(keywords, country));
  if (sources.includes('empresas_cr')) tasks.push(scrapeCREmpresas(keywords));

  const results = await Promise.all(tasks);
  allResults = results.flat().slice(0, maxResults);

  return new Response(JSON.stringify({
    count: allResults.length,
    sources: results.map((r, i) => ({ source: sources[i] || 'unknown', count: r.length })),
    results: allResults,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequest(context: any) {
  return await onRequestPost(context);
}