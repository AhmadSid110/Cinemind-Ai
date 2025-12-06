import { MediaItem, MediaDetail, Episode, Season, PersonDetail } from '../types';

const BASE_URL = 'https://api.themoviedb.org/3';

// Helper to construct URL with API Key
const getUrl = (endpoint: string, apiKey: string, params: Record<string, string> = {}) => {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', apiKey);
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
  return url.toString();
};

export const validateKey = async (apiKey: string): Promise<{ ok: boolean; reason?: string }> => {
  try {
    const trimmed = apiKey.trim();                 // avoid trailing spaces issues
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
      body?.status_message ||
      body?.statusCode ||
      `HTTP ${res.status}`;

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

export const getTrending = async (apiKey: string): Promise<MediaItem[]> => {
  const res = await fetch(getUrl('/trending/all/day', apiKey, { language: 'en-US' }));
  const data = await res.json();
  return data.results || [];
};

export const searchMulti = async (apiKey: string, query: string): Promise<MediaItem[]> => {
  const res = await fetch(getUrl('/search/multi', apiKey, {
    query,
    include_adult: 'false',
    language: 'en-US',
    page: '1'
  }));
  const data = await res.json();
  return data.results || [];
};

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
  return (data.results || []).map((item: any) => ({ ...item, media_type: type }));
};

export const getDetails = async (
  apiKey: string,
  type: 'movie' | 'tv',
  id: number
): Promise<MediaDetail> => {
  const res = await fetch(getUrl(`/${type}/${id}`, apiKey, {
    append_to_response: 'credits,videos,recommendations,external_ids'
  }));
  if (!res.ok) throw new Error('Failed to fetch details');
  const data = await res.json();
  return { ...data, media_type: type };
};

export const getPersonDetails = async (apiKey: string, id: number): Promise<PersonDetail> => {
    const res = await fetch(getUrl(`/person/${id}`, apiKey, {
        append_to_response: 'combined_credits'
    }));
    if (!res.ok) throw new Error('Failed to fetch person details');
    const data = await res.json();
    return data;
};

// Helper to find ID from name (for AI flow)
export const findIdByName = async (apiKey: string, type: 'movie' | 'tv', name: string): Promise<number | null> => {
    const res = await fetch(getUrl(`/search/${type}`, apiKey, { query: name }));
    const data = await res.json();
    if (data.results && data.results.length > 0) {
        return data.results[0].id;
    }
    return null;
}

export const getShowSeasons = async (apiKey: string, showId: number): Promise<Season[]> => {
    const details = await getDetails(apiKey, 'tv', showId);
    return details.seasons || [];
}

export const getSeasonEpisodes = async (apiKey: string, showId: number, seasonNumber: number): Promise<Episode[]> => {
    const res = await fetch(getUrl(`/tv/${showId}/season/${seasonNumber}`, apiKey));
    if(!res.ok) return [];
    const data = await res.json();
    return data.episodes || [];
}

export const getPersonId = async (apiKey: string, name: string): Promise<number | null> => {
     const res = await fetch(getUrl('/search/person', apiKey, { query: name }));
    const data = await res.json();
    if (data.results && data.results.length > 0) {
        return data.results[0].id;
    }
    return null;
}