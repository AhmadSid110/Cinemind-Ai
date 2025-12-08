// src/services/tmdbService.ts
import { MediaItem, MediaDetail, Episode, Season, PersonDetail, Review } from '../types';

const BASE_URL = 'https://api.themoviedb.org/3';

// Helper to construct URL with API Key
const getUrl = (
  endpoint: string,
  apiKey: string,
  params: Record<string, string> = {}
) => {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', apiKey);
  Object.keys(params).forEach((key) =>
    url.searchParams.append(key, params[key])
  );
  return url.toString();
};

/**
 * Validate TMDB key, with detailed reason for failure.
 */
export const validateKey = async (
  apiKey: string
): Promise<{ ok: boolean; reason?: string }> => {
  try {
    const trimmed = apiKey.trim(); // avoid trailing spaces issues
    if (!trimmed) {
      return { ok: false, reason: 'empty-key' };
    }

    const res = await fetch(getUrl('/configuration', trimmed));

    if (res.ok) {
      return { ok: true };
    }

    let body: any = {};
    try {
      body = await res.json();
    } catch {
      // ignore JSON parse error
    }

    const statusMsg =
      body?.status_message || body?.statusCode || `HTTP ${res.status}`;

    console.error('TMDB validateKey failed:', {
      status: res.status,
      statusText: res.statusText,
      statusMsg,
      body,
    });

    return { ok: false, reason: statusMsg };
  } catch (e: any) {
    console.error('TMDB validateKey network error:', e);
    return { ok: false, reason: e?.message || 'network-error' };
  }
};

/**
 * Combined trending (all types) – still used in some flows if needed.
 */
export const getTrending = async (apiKey: string): Promise<MediaItem[]> => {
  const res = await fetch(
    getUrl('/trending/all/day', apiKey, { language: 'en-US' })
  );
  const data = await res.json();
  return data.results || [];
};

/**
 * Trending Movies (day)
 */
export const getTrendingMovies = async (
  apiKey: string
): Promise<MediaItem[]> => {
  const res = await fetch(
    getUrl('/trending/movie/day', apiKey, { language: 'en-US' })
  );
  const data = await res.json();
  return (data.results || []).map((item: any) => ({
    ...item,
    media_type: 'movie',
  })) as MediaItem[];
};

/**
 * Trending TV (day)
 */
export const getTrendingTv = async (apiKey: string): Promise<MediaItem[]> => {
  const res = await fetch(
    getUrl('/trending/tv/day', apiKey, { language: 'en-US' })
  );
  const data = await res.json();
  return (data.results || []).map((item: any) => ({
    ...item,
    media_type: 'tv',
  })) as MediaItem[];
};

/**
 * "In Theatres" – Now Playing Movies
 */
export const getNowPlayingMovies = async (
  apiKey: string
): Promise<MediaItem[]> => {
  const res = await fetch(
    getUrl('/movie/now_playing', apiKey, { language: 'en-US', page: '1' })
  );
  const data = await res.json();
  return (data.results || []).map((item: any) => ({
    ...item,
    media_type: 'movie',
  })) as MediaItem[];
};

/**
 * "Streaming Now on TV" – On The Air TV shows
 */
export const getOnTheAirTv = async (
  apiKey: string
): Promise<MediaItem[]> => {
  const res = await fetch(
    getUrl('/tv/on_the_air', apiKey, { language: 'en-US', page: '1' })
  );
  const data = await res.json();
  return (data.results || []).map((item: any) => ({
    ...item,
    media_type: 'tv',
  })) as MediaItem[];
};

/**
 * Generic multi-search (movies, TV, people, etc.).
 */
export const searchMulti = async (
  apiKey: string,
  query: string
): Promise<MediaItem[]> => {
  const res = await fetch(
    getUrl('/search/multi', apiKey, {
      query,
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    })
  );
  const data = await res.json();
  return data.results || [];
};

/**
 * Autocomplete suggestions for the search box.
 * - Uses /search/multi
 * - Filters to movies + TV only
 * - Returns only top `limit` items (for dropdown).
 */
export const getAutocompleteSuggestions = async (
  apiKey: string,
  query: string,
  limit: number = 8
): Promise<MediaItem[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const res = await fetch(
    getUrl('/search/multi', apiKey, {
      query: trimmed,
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    })
  );

  const data = await res.json();
  const all: any[] = data.results || [];

  // Only keep movies & TV shows for suggestions
  const filtered = all.filter(
    (item) => item.media_type === 'movie' || item.media_type === 'tv'
  );

  return filtered.slice(0, limit) as MediaItem[];
};

/**
 * Discover API for AI-powered filtering (genres, year, etc.).
 */
export const discoverMedia = async (
  apiKey: string,
  type: 'movie' | 'tv',
  params: Record<string, any>
): Promise<MediaItem[]> => {
  // Convert all params to strings for URLSearchParams
  const stringParams: Record<string, string> = {
    include_adult: 'false',
    include_video: 'false',
    language: 'en-US',
    page: '1',
  };

  Object.entries(params).forEach(([key, value]) => {
    stringParams[key] = String(value);
  });

  const res = await fetch(getUrl(`/discover/${type}`, apiKey, stringParams));
  const data = await res.json();
  return (data.results || []).map((item: any) => ({
    ...item,
    media_type: type,
  }));
};

/**
 * Full details for a movie or TV show.
 */
export const getDetails = async (
  apiKey: string,
  type: 'movie' | 'tv',
  id: number
): Promise<MediaDetail> => {
  const res = await fetch(
    getUrl(`/${type}/${id}`, apiKey, {
      append_to_response: 'credits,videos,recommendations,external_ids,reviews',
    })
  );
  if (!res.ok) throw new Error('Failed to fetch details');
  const data = await res.json();
  return { ...data, media_type: type };
};

/**
 * Person details + combined credits (used for cast profile view).
 */
export const getPersonDetails = async (
  apiKey: string,
  id: number
): Promise<PersonDetail> => {
  const res = await fetch(
    getUrl(`/person/${id}`, apiKey, {
      append_to_response: 'combined_credits',
    })
  );
  if (!res.ok) throw new Error('Failed to fetch person details');
  const data = await res.json();
  return data;
};

/**
 * Helper to find first matching movie/TV show ID by name
 * (used in AI "top episodes" flow).
 */
export const findIdByName = async (
  apiKey: string,
  type: 'movie' | 'tv',
  name: string
): Promise<number | null> => {
  const res = await fetch(
    getUrl(`/search/${type}`, apiKey, { query: name })
  );
  const data = await res.json();
  if (data.results && data.results.length > 0) {
    return data.results[0].id;
  }
  return null;
};

export const getShowSeasons = async (
  apiKey: string,
  showId: number
): Promise<Season[]> => {
  const details = await getDetails(apiKey, 'tv', showId);
  return details.seasons || [];
};

export const getSeasonEpisodes = async (
  apiKey: string,
  showId: number,
  seasonNumber: number
): Promise<Episode[]> => {
  const res = await fetch(
    getUrl(`/tv/${showId}/season/${seasonNumber}`, apiKey)
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.episodes || [];
};

export const getPersonId = async (
  apiKey: string,
  name: string
): Promise<number | null> => {
  const res = await fetch(
    getUrl('/search/person', apiKey, { query: name })
  );
  const data = await res.json();
  if (data.results && data.results.length > 0) {
    return data.results[0].id;
  }
  return null;
};

export interface EpisodeDetail extends Episode {
  credits?: any;
  external_ids?: any;
  videos?: {
    results: any[];
  };
  reviews?: {
    results: Review[];
    page: number;
    total_pages: number;
    total_results: number;
  };
  show_name?: string;
}

/**
 * Full details for a specific TV episode.
 */
export const getEpisodeDetails = async (
  apiKey: string,
  showId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<EpisodeDetail> => {
  const res = await fetch(
    getUrl(
      `/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`,
      apiKey,
      {
        append_to_response: 'credits,external_ids,videos,reviews',
      }
    )
  );
  if (!res.ok) throw new Error('Failed to fetch episode details');
  const data = await res.json();
  return data as EpisodeDetail;
};