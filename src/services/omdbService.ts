// src/services/omdbService.ts
// Simple OMDb service with caching, concurrency limit, retry/backoff and fallback by title.

export type OmdbResult = {
  imdbID?: string;
  Title?: string;
  Year?: string;
  imdbRating?: string;
  imdbVotes?: string;
  Metascore?: string;
  Ratings?: Array<{ Source: string; Value: string }>;
  Response?: "True" | "False";
  Error?: string;
};

// Legacy interface for backward compatibility
export interface OmdbRating extends OmdbResult {}

const OMDB_BASE = 'https://www.omdbapi.com/';
const CACHE_KEY = "omdb_cache_v1";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_CONCURRENT = 4;
const REQUEST_DELAY_MS = 120; // delay between starting requests
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

interface CacheEntry {
  ts: number;
  data: OmdbResult | null;
}

// In-memory cache for fast access during session
let inMemoryCache: Record<string, CacheEntry> = {};

function loadCache(): Record<string, CacheEntry> {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    inMemoryCache = parsed;
    return parsed;
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    inMemoryCache = cache;
  } catch (err) {
    console.warn('Failed to save OMDb cache:', err);
  }
}

function getCached(key: string): OmdbResult | null {
  const cache = inMemoryCache;
  const entry = cache[key];
  if (!entry) return null;
  
  const age = Date.now() - entry.ts;
  if (age > CACHE_TTL_MS) {
    // Expired, remove it
    delete cache[key];
    saveCache(cache);
    return null;
  }
  
  return entry.data;
}

function setCached(key: string, data: OmdbResult | null) {
  const cache = loadCache();
  cache[key] = { ts: Date.now(), data };
  saveCache(cache);
}

// Concurrency control
let activeRequests = 0;
const requestQueue: Array<() => void> = [];

async function throttledFetch(url: string, retries = 0): Promise<Response> {
  // Wait for slot
  if (activeRequests >= MAX_CONCURRENT) {
    await new Promise<void>(resolve => requestQueue.push(resolve));
  }
  
  activeRequests++;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    // Small delay before next request
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
    
    return res;
  } catch (err) {
    // Retry on network error
    if (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (retries + 1)));
      return throttledFetch(url, retries + 1);
    }
    throw err;
  } finally {
    activeRequests--;
    // Process queue
    const next = requestQueue.shift();
    if (next) next();
  }
}

/**
 * Fetch OMDb data by IMDb ID (preferred method)
 */
export async function fetchOmdbByImdbId(imdbId: string, apiKey: string): Promise<OmdbResult | null> {
  if (!imdbId || !apiKey) return null;
  
  const cacheKey = `id:${imdbId}`;
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;
  
  try {
    const url = new URL(OMDB_BASE);
    url.searchParams.set('i', imdbId);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('r', 'json');
    
    const res = await throttledFetch(url.toString());
    if (!res.ok) throw new Error(`OMDb HTTP ${res.status}`);
    
    const data = await res.json() as OmdbResult;
    
    if (data?.Response === 'False') {
      console.warn('OMDb response false:', data?.Error);
      setCached(cacheKey, null);
      return null;
    }
    
    setCached(cacheKey, data);
    return data;
  } catch (err) {
    console.error('fetchOmdbByImdbId error', err);
    return null;
  }
}

/**
 * Fallback: search OMDb by title and year (less reliable)
 */
export async function fetchOmdbByTitle(
  title: string,
  year: string | number | undefined,
  apiKey: string
): Promise<OmdbResult | null> {
  if (!title || !apiKey) return null;
  
  const cacheKey = `title:${title}:${year || 'any'}`;
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;
  
  try {
    const url = new URL(OMDB_BASE);
    url.searchParams.set('t', title);
    if (year) url.searchParams.set('y', String(year));
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('r', 'json');
    
    const res = await throttledFetch(url.toString());
    if (!res.ok) throw new Error(`OMDb HTTP ${res.status}`);
    
    const data = await res.json() as OmdbResult;
    
    if (data?.Response === 'False') {
      console.warn('OMDb title search failed:', data?.Error);
      setCached(cacheKey, null);
      return null;
    }
    
    setCached(cacheKey, data);
    return data;
  } catch (err) {
    console.error('fetchOmdbByTitle error', err);
    return null;
  }
}

/**
 * Clear the OMDb cache
 */
export function clearOmdbCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    inMemoryCache = {};
  } catch (err) {
    console.warn('Failed to clear OMDb cache:', err);
  }
}

// Initialize in-memory cache on module load
loadCache();