import { CONFIG } from '../config';

interface BraveSearchResult {
  title: string;
  description: string;
  url: string;
  source: string;
  date?: string;
}

interface CacheEntry {
  data: BraveSearchResult[];
  timestamp: number;
}

// Cache configuration
const CACHE_DURATION = {
  NEWS: 1000 * 60 * 60, // 1 hour for news
  REVIEWS: 1000 * 60 * 60 * 24, // 24 hours for reviews
  BIOGRAPHY: 1000 * 60 * 60 * 24 * 7, // 1 week for biography
  SUPPORT_LINKS: 1000 * 60 * 60 * 24, // 24 hours for support links
};

// Cache storage
const cache = new Map<string, CacheEntry>();

// Helper function to generate cache key
function generateCacheKey(type: string, query: string): string {
  return `${type}:${query.toLowerCase()}`;
}

// Helper function to check if cache is valid
function isCacheValid(key: string, duration: number): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  return Date.now() - entry.timestamp < duration;
}

// Helper function to get cached data
function getCachedData(key: string): BraveSearchResult[] | null {
  const entry = cache.get(key);
  return entry ? entry.data : null;
}

// Helper function to set cache data
function setCacheData(key: string, data: BraveSearchResult[], duration: number): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

// Simple rate limiting
let lastApiCall = 0;
const MIN_DELAY_BETWEEN_CALLS = 1000; // 1 second between calls

async function searchMusicInfo(query: string): Promise<BraveSearchResult[]> {
  try {
    // Simple rate limiting - wait at least 1 second between API calls
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCall;
    if (timeSinceLastCall < MIN_DELAY_BETWEEN_CALLS) {
      await new Promise(resolve => setTimeout(resolve, MIN_DELAY_BETWEEN_CALLS - timeSinceLastCall));
    }
    lastApiCall = Date.now();

    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.append('q', query);
    url.searchParams.append('count', '5');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': CONFIG.brave.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.web?.results?.map((result: any) => ({
      title: result.title,
      description: result.description,
      url: result.url,
      source: result.source,
      date: result.date,
    })) || [];
  } catch (error) {
    console.error('Error fetching from Brave API:', error);
    return [];
  }
}

export async function getArtistNews(artist: string): Promise<BraveSearchResult[]> {
  const cacheKey = generateCacheKey('news', artist);
  
  // Check cache first
  if (isCacheValid(cacheKey, CACHE_DURATION.NEWS)) {
    const cachedData = getCachedData(cacheKey);
    if (cachedData) return cachedData;
  }

  // If not in cache or expired, fetch new data
  const query = `${artist} music news recent`;
  const results = await searchMusicInfo(query);
  
  // Cache the results
  setCacheData(cacheKey, results, CACHE_DURATION.NEWS);
  
  return results;
}

export async function getAlbumReviews(album: string, artist: string): Promise<BraveSearchResult[]> {
  const cacheKey = generateCacheKey('reviews', `${artist} ${album}`);
  
  // Check cache first
  if (isCacheValid(cacheKey, CACHE_DURATION.REVIEWS)) {
    const cachedData = getCachedData(cacheKey);
    if (cachedData) return cachedData;
  }

  // If not in cache or expired, fetch new data
  const query = `${artist} ${album} album review`;
  const results = await searchMusicInfo(query);
  
  // Cache the results
  setCacheData(cacheKey, results, CACHE_DURATION.REVIEWS);
  
  return results;
}

export async function getArtistBiography(artist: string): Promise<BraveSearchResult[]> {
  const cacheKey = generateCacheKey('biography', artist);
  
  // Check cache first
  if (isCacheValid(cacheKey, CACHE_DURATION.BIOGRAPHY)) {
    const cachedData = getCachedData(cacheKey);
    if (cachedData) return cachedData;
  }

  // If not in cache or expired, fetch new data
  const query = `${artist} musician biography`;
  const results = await searchMusicInfo(query);
  
  // Cache the results
  setCacheData(cacheKey, results, CACHE_DURATION.BIOGRAPHY);
  
  return results;
}

// Exported helper for support links with caching
export async function searchSupportLinks(query: string): Promise<BraveSearchResult[]> {
  const cacheKey = generateCacheKey('support', query);
  
  // Check cache first
  if (isCacheValid(cacheKey, CACHE_DURATION.SUPPORT_LINKS)) {
    const cachedData = getCachedData(cacheKey);
    if (cachedData) return cachedData;
  }

  // If not in cache or expired, fetch new data
  const results = await searchMusicInfo(query);
  
  // Cache the results
  setCacheData(cacheKey, results, CACHE_DURATION.SUPPORT_LINKS);
  
  return results;
} 