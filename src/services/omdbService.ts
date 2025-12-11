// src/services/omdbService.ts
export interface OmdbRating {
  imdbRating?: string; // "7.8"
  imdbVotes?: string;
  Metascore?: string;  // Metacritic
  Ratings?: Array<{ Source: string; Value: string }>; // includes "Rotten Tomatoes"
  Response?: string;
  Error?: string;
}

const OMDB_BASE = 'https://www.omdbapi.com/';

export async function fetchOmdbByImdbId(imdbId: string, apiKey: string): Promise<OmdbRating | null> {
  if (!imdbId || !apiKey) return null;
  try {
    const url = new URL(OMDB_BASE);
    url.searchParams.set('i', imdbId);
    url.searchParams.set('apikey', apiKey);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`OMDb HTTP ${res.status}`);
    const data = await res.json();
    if (data?.Response === 'False') {
      console.warn('OMDb response false:', data?.Error);
      return null;
    }
    return data as OmdbRating;
  } catch (err) {
    console.error('fetchOmdbByImdbId error', err);
    return null;
  }
}