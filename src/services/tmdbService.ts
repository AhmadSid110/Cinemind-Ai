import {
  MediaItem,
  MediaDetail,
  Episode,
  Season,
  PersonDetail,
} from '../types';

const BASE_URL = 'https://api.themoviedb.org/3';

/* =========================================================
   Helper: Build URL with api_key + params
========================================================= */
const getUrl = (
  endpoint: string,
  apiKey: string,
  params: Record<string, string | number> = {}
) => {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', apiKey);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, String(value));
  });
  return url.toString();
};

/* =========================================================
   Validate TMDB API Key
========================================================= */
export const validateKey = async (
  apiKey: string
): Promise<{ ok: boolean; reason?: string }> => {
  try {
    const trimmed = apiKey.trim();
    if (!trimmed) return { ok: false, reason: 'empty-key' };

    const res = await fetch(getUrl('/configuration', trimmed));
    if (res.ok) return { ok: true };

    let body: any = {};
    try {
      body = await res.json();
    } catch {}

    return {
      ok: false,
      reason: body?.status_message || `HTTP ${res.status}`,
    };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'network-error' };
  }
};

/* =========================================================
   Trending (Movies + TV together)
========================================================= */
export const getTrending = async (
  apiKey: string
): Promise<MediaItem[]> => {
  const res = await fetch(
    getUrl('/trending/all/day', apiKey, { language: 'en-US' })
  );
  if (!res.ok) throw new Error('Trending fetch failed');
  const data = await res.json();
  return data.results || [];
};

/* =========================================================
   Plain Title Search (MOST important for your fix)
---------------------------------------------------------
   - Used when searching "Rick and Morty", "Badlands", etc.
   - DO NOT add filters here (TMDB relevance is best)
========================================================= */
export const searchMulti = async (
  apiKey: string,
  query: string
): Promise<MediaItem[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const res = await fetch(
    getUrl('/search/multi', apiKey, {
      query: trimmed,
      include_adult: 'false',
      language: 'en-US',
      page: 1,
    })
  );

  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();

  return (data.results || []).filter(
    (r: MediaItem) =>
      r.media_type === 'movie' || r.media_type === 'tv'
  );
};

/* =========================================================
   Autocomplete Suggestions (Dropdown)
========================================================= */
export const getAutocompleteSuggestions = async (
  apiKey: string,
  query: string,
  limit = 8
): Promise<MediaItem[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const res = await fetch(
    getUrl('/search/multi', apiKey, {
      query: trimmed,
      include_adult: 'false',
      language: 'en-US',
      page: 1,
    })
  );

  if (!res.ok) return [];
  const data = await res.json();

  return (data.results || [])
    .filter(
      (i: MediaItem) =>
        (i.media_type === 'movie' || i.media_type === 'tv') &&
        (i.title || i.name)
    )
    .slice(0, limit);
};

/* =========================================================
   Discover (Used for AI “Top Rated Sci-Fi”, etc.)
========================================================= */
export const discoverMedia = async (
  apiKey: string,
  type: 'movie' | 'tv',
  params: Record<string, any>
): Promise<MediaItem[]> => {
  const baseParams: Record<string, string | number> = {
    include_adult: false,
    include_video: false,
    language: 'en-US',
    page: 1,
    ...params,
  };

  const res = await fetch(
    getUrl(`/discover/${type}`, apiKey, baseParams)
  );

  if (!res.ok) throw new Error('Discover failed');
  const data = await res.json();

  return (data.results || []).map((item: any) => ({
    ...item,
    media_type: type,
  }));
};

/* =========================================================
   Movie / TV Details
========================================================= */
export const getDetails = async (
  apiKey: string,
  type: 'movie' | 'tv',
  id: number
): Promise<MediaDetail> => {
  const res = await fetch(
    getUrl(`/${type}/${id}`, apiKey, {
      append_to_response:
        'credits,videos,recommendations,external_ids',
    })
  );

  if (!res.ok) throw new Error('Details fetch failed');
  const data = await res.json();
  return { ...data, media_type: type };
};

/* =========================================================
   Person Details
========================================================= */
export const getPersonDetails = async (
  apiKey: string,
  id: number
): Promise<PersonDetail> => {
  const res = await fetch(
    getUrl(`/person/${id}`, apiKey, {
      append_to_response: 'combined_credits',
    })
  );
  if (!res.ok) throw new Error('Person fetch failed');
  return await res.json();
};

/* =========================================================
   Find Movie / TV ID by Name (AI episode search)
========================================================= */
export const findIdByName = async (
  apiKey: string,
  type: 'movie' | 'tv',
  name: string
): Promise<number | null> => {
  const res = await fetch(
    getUrl(`/search/${type}`, apiKey, {
      query: name,
    })
  );
  if (!res.ok) return null;

  const data = await res.json();
  return data?.results?.[0]?.id ?? null;
};

/* =========================================================
   Seasons + Episodes (for episode ranking)
========================================================= */
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

/* =========================================================
   Person Search (AI filters)
========================================================= */
export const getPersonId = async (
  apiKey: string,
  name: string
): Promise<number | null> => {
  const res = await fetch(
    getUrl('/search/person', apiKey, { query: name })
  );

  if (!res.ok) return null;
  const data = await res.json();
  return data?.results?.[0]?.id ?? null;
};