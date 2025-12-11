// src/hooks/useRatingsCache.ts
import { useEffect, useRef, useState } from 'react';
import { fetchOmdbByImdbId } from '../services/omdbService';
import * as tmdb from '../services/tmdbService';

type RatingEntry = {
  imdbId?: string | null;
  imdbRating?: string | null;   // "7.8"
  imdbVotes?: string | null;    // "123,456"
  metascore?: string | null;    // "62"
  rottenTomatoes?: string | null; // "86%"
  fetchedAt: number;
};

type RatingsMap = Record<string, RatingEntry>; // keys like "movie:tmdbId", "tv:tmdbId", "episode:tmdbShowId:S01E02"

const STORAGE_KEY = 'omdb_ratings_cache_v1';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// concurrency limiter
const MAX_CONCURRENT = 3;
const FETCH_DELAY_MS = 250; // small polite delay

export function useRatingsCache({
  tmdbApiKey,
  omdbApiKey,
  ttlMs = DEFAULT_TTL_MS,
}: {
  tmdbApiKey: string;
  omdbApiKey?: string | null;
  ttlMs?: number;
}) {
  const [map, setMap] = useState<RatingsMap>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as RatingsMap) : {};
    } catch {
      return {};
    }
  });

  const queue = useRef<string[]>([]);
  const queuedKeys = useRef<Set<string>>(new Set());
  const running = useRef(0);
  const mounted = useRef(true);

  // pending promises to dedupe concurrent refreshes for the same key
  const pendingPromises = useRef<Map<string, Promise<RatingEntry | null>>>(new Map());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mounted.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('Could not persist ratings cache', e);
    }
  }, [map]);

  const mapKey = (mediaType: 'movie' | 'tv', tmdbId: number) => `${mediaType}:${tmdbId}`;
  const episodeKey = (tmdbShowIdOrImdb: string | number, season: number, episode: number) => {
    // prefer numeric tmdbShowId for local key, but accept imdb string if tmdbShowId not available
    return `episode:${tmdbShowIdOrImdb}:${String(season).padStart(2, '0')}:${String(episode).padStart(2, '0')}`;
  };

  // queueing helpers
  function enqueueKey(key: string) {
    if (queuedKeys.current.has(key)) return;
    queuedKeys.current.add(key);
    queue.current.push(key);
    void processQueue();
  }

  async function processQueue() {
    if (running.current >= MAX_CONCURRENT) return;
    const key = queue.current.shift();
    if (!key) return;
    queuedKeys.current.delete(key);
    running.current++;
    try {
      const pending = pendingPromises.current.get(key);
      if (pending) {
        await pending;
      } else {
        // nothing - maybe the refresh call will create a pending
        await new Promise((r) => setTimeout(r, 0));
      }
    } catch (e) {
      console.error('ratings queue job error', e);
    } finally {
      running.current--;
      if (mounted.current) {
        setTimeout(() => processQueue(), FETCH_DELAY_MS);
      }
    }
  }

  // Public: get cached show-level
  function getCached(mediaType: 'movie' | 'tv', tmdbId: number) {
    const key = mapKey(mediaType, tmdbId);
    return map[key] ?? null;
  }

  // Public: get cached episode-level
  function getCachedEpisode(tmdbShowIdOrImdb: string | number, season: number, episode: number) {
    const key = episodeKey(tmdbShowIdOrImdb, season, episode);
    return map[key] ?? null;
  }

  // Core refresh for show-level (existing behavior) - returns promise
  function refresh(mediaType: 'movie' | 'tv', tmdbId: number, force: boolean = false): Promise<RatingEntry | null> {
    const key = mapKey(mediaType, tmdbId);
    const existing = map[key];
    const now = Date.now();
    if (!force && existing && now - existing.fetchedAt < ttlMs) {
      return Promise.resolve(existing);
    }

    const pending = pendingPromises.current.get(key);
    if (pending) return pending;

    const p = (async (): Promise<RatingEntry | null> => {
      try {
        if (!tmdbApiKey) {
          const entry: RatingEntry = { imdbId: null, fetchedAt: Date.now() };
          if (mounted.current) setMap((m) => ({ ...m, [key]: entry }));
          return entry;
        }

        const ext = await tmdb.getExternalIds(tmdbApiKey, mediaType, tmdbId);
        const imdbId = ext?.imdb_id ?? null;
        if (!imdbId || !omdbApiKey) {
          const entry: RatingEntry = { imdbId: imdbId ?? null, fetchedAt: Date.now() };
          if (mounted.current) setMap((m) => ({ ...m, [key]: entry }));
          return entry;
        }

        // fetch show-level OMDb data
        const data = await fetchOmdbByImdbId(imdbId, omdbApiKey);
        if (!data) {
          const entry: RatingEntry = { imdbId, fetchedAt: Date.now() };
          if (mounted.current) setMap((m) => ({ ...m, [key]: entry }));
          return entry;
        }

        const rt = (data.Ratings || []).find((r: any) => r.Source.toLowerCase().includes('rotten'))?.Value ?? null;
        const metascore = data.Metascore ?? null;
        const entry: RatingEntry = {
          imdbId,
          imdbRating: data.imdbRating ?? null,
          imdbVotes: data.imdbVotes ?? null,
          metascore,
          rottenTomatoes: rt,
          fetchedAt: Date.now(),
        };
        if (mounted.current) setMap((m) => ({ ...m, [key]: entry }));
        return entry;
      } catch (err) {
        console.error('refresh rating failed', err);
        return null;
      } finally {
        pendingPromises.current.delete(key);
      }
    })();

    pendingPromises.current.set(key, p);
    enqueueKey(key);
    return p;
  }

  /**
   * Fetch episode-level OMDb data:
   * - showImdbId: the series IMDb id (e.g. tt1234567) OR
   * - tmdbShowIdOrImdb: prefer tmdb show id for local cache key, but if missing pass the imdb string
   *
   * Note: OMDb supports fetching episode info via:
   *   ?i=tt1234567&Season=1&Episode=2&apikey=...
   *
   * We call fetchOmdbByImdbId(imdbId, apikey, season?, episode?) — ensure your service supports the season/episode args.
   */
  function refreshEpisode(
    showImdbId: string | null,
    tmdbShowIdOrImdb: string | number,
    season: number,
    episode: number,
    force: boolean = false
  ): Promise<RatingEntry | null> {
    const key = episodeKey(tmdbShowIdOrImdb, season, episode);
    const existing = map[key];
    const now = Date.now();
    if (!force && existing && now - existing.fetchedAt < ttlMs) {
      return Promise.resolve(existing);
    }

    const pending = pendingPromises.current.get(key);
    if (pending) return pending;

    const p = (async (): Promise<RatingEntry | null> => {
      try {
        if (!showImdbId || !omdbApiKey) {
          // store minimal record to avoid repeated failed calls
          const entry: RatingEntry = { imdbId: showImdbId ?? null, fetchedAt: Date.now() };
          if (mounted.current) setMap((m) => ({ ...m, [key]: entry }));
          return entry;
        }

        // IMPORTANT: fetchOmdbByImdbId must accept season & episode optional parameters.
        // e.g. fetchOmdbByImdbId('tt123', apiKey, 1, 2)
        const data = await fetchOmdbByImdbId(showImdbId, omdbApiKey, season, episode);
        if (!data) {
          const entry: RatingEntry = { imdbId: showImdbId, fetchedAt: Date.now() };
          if (mounted.current) setMap((m) => ({ ...m, [key]: entry }));
          return entry;
        }

        const rt = (data.Ratings || []).find((r: any) => r.Source.toLowerCase().includes('rotten'))?.Value ?? null;
        const metascore = data.Metascore ?? null;

        const entry: RatingEntry = {
          imdbId: showImdbId,
          imdbRating: data.imdbRating ?? null,
          imdbVotes: data.imdbVotes ?? null,
          metascore,
          rottenTomatoes: rt,
          fetchedAt: Date.now(),
        };

        if (mounted.current) setMap((m) => ({ ...m, [key]: entry }));
        return entry;
      } catch (err) {
        console.error('refresh episode rating failed', err);
        return null;
      } finally {
        pendingPromises.current.delete(key);
      }
    })();

    pendingPromises.current.set(key, p);
    enqueueKey(key);
    return p;
  }

  // Bulk ensure for list (show-level)
  function ensureForList(items: Array<{ media_type: 'movie' | 'tv'; id: number }>, maxToEnqueue = 10) {
    const now = Date.now();
    let enqueued = 0;
    for (const it of items) {
      if (enqueued >= maxToEnqueue) break;
      const key = mapKey(it.media_type, it.id);
      const existing = map[key];
      if (!existing || now - existing.fetchedAt >= ttlMs) {
        void refresh(it.media_type, it.id, true).catch((e) => console.error('ensureForList refresh failed', e));
        enqueued++;
      }
    }
  }

  function clearCache() {
    if (mounted.current) setMap({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  return {
    getCached,
    refresh,
    getCachedEpisode,
    refreshEpisode,
    ensureForList,
    clearCache,
    rawMap: map,
  };
}