// Cloudflare Pages Function — Proxy to Adzuna API
// This hides the API key from the browser and handles CORS
// Route: POST /api/jobs

interface JobSearchRequest {
  keywords: string;
  country: string;
  results_per_page?: number;
  max_days_old?: number;
}

interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string; area: string[] };
  salary_min?: number;
  salary_max?: number;
  description: string;
  redirect_url: string;
  created: string;
  category: { label: string };
  contract_time: string;
}

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const body: JobSearchRequest = await request.json();

    const appId = env.ADZUNA_APP_ID || '21a60a8d';
    const apiKey = env.ADZUNA_API_KEY || '5fd41eb6a65b65452d243a33cdb57d4c';
    const country = body.country || 'us';
    const keywords = encodeURIComponent(body.keywords || 'software developer');
    const resultsPerPage = body.results_per_page || 20;
    const maxDaysOld = body.max_days_old || 7;

    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${apiKey}&results_per_page=${resultsPerPage}&what=${keywords}&max_days_old=${maxDaysOld}&content-type=application/json`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Adzuna API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // Clean and simplify the response
    const simplified = {
      count: data.count || 0,
      results: (data.results || []).map((job: AdzunaJob) => ({
        id: job.id,
        title: job.title,
        company: job.company?.display_name || 'Unknown',
        location: job.location?.display_name || 'Remote',
        salary_min: job.salary_min || null,
        salary_max: job.salary_max || null,
        description: job.description?.substring(0, 1000) || '',
        url: job.redirect_url || '',
        created: job.created || '',
        category: job.category?.label || '',
        // Store full description for analysis
        full_description: job.description || '',
      })),
    };

    return new Response(JSON.stringify(simplified), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Adzuna proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// POST is caught by onRequestPost, but we need it accessible as default
export async function onRequest(context: any) {
  return await onRequestPost(context);
}