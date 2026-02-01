/**
 * Service for searching academic papers via Semantic Scholar API.
 * Free API, no key required. Rate limit: 100 requests/5 minutes.
 */

export interface Paper {
  paperId: string;
  title: string;
  abstract: string | null;
  year: number | null;
  authors: { name: string }[];
  citationCount: number;
  url: string;
}

interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract: string | null;
  year: number | null;
  authors: { name: string }[];
  citationCount: number;
  url: string;
}

interface SemanticScholarResponse {
  total: number;
  offset: number;
  data: SemanticScholarPaper[];
}

const SEMANTIC_SCHOLAR_API = 'https://api.semanticscholar.org/graph/v1/paper/search';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000;

/** Sleep for a given number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch with exponential backoff retry on rate limit */
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });

    if (response.status !== 429) {
      return response;
    }

    // Rate limited - check if we have retries left
    if (attempt < retries) {
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(backoffMs);
    }
  }

  // All retries exhausted
  throw new Error('Rate limit exceeded after multiple retries. Please wait and try again later.');
}

/**
 * Search for papers using the Semantic Scholar API.
 * @param keywords Array of search keywords
 * @param limit Maximum number of papers to return (default 10)
 * @returns Array of papers
 */
export async function searchPapers(keywords: string[], limit: number = 10): Promise<Paper[]> {
  if (!keywords || keywords.length === 0) {
    return [];
  }

  const query = keywords.join(' ');
  const encodedQuery = encodeURIComponent(query);
  const fields = 'paperId,title,abstract,year,authors,citationCount,url';
  const url = `${SEMANTIC_SCHOLAR_API}?query=${encodedQuery}&limit=${limit}&fields=${fields}`;

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      throw new Error(`Semantic Scholar API error: ${response.status}`);
    }

    const data: SemanticScholarResponse = await response.json();

    return data.data.map((paper) => ({
      paperId: paper.paperId,
      title: paper.title,
      abstract: paper.abstract,
      year: paper.year,
      authors: paper.authors || [],
      citationCount: paper.citationCount || 0,
      url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Paper search failed: ${message}`);
  }
}

/**
 * Class-based service wrapper for paper searching.
 */
export class PaperSearchService {
  private static instance: PaperSearchService;

  public static getInstance(): PaperSearchService {
    if (!PaperSearchService.instance) {
      PaperSearchService.instance = new PaperSearchService();
    }
    return PaperSearchService.instance;
  }

  /**
   * Search for papers by keywords.
   */
  async search(keywords: string[], limit: number = 10): Promise<Paper[]> {
    return searchPapers(keywords, limit);
  }
}

export const paperSearchService = PaperSearchService.getInstance();
