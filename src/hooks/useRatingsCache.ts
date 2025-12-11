// src/hooks/useRatingsCache.ts
import { useEffect, useRef, useState } from 'react';
import * as tmdb from '../services/tmdbService';

type RatingEntry = {
  imdbId?: string | null;
  imdbRating?: string | null;   // e.g. "7.8"
  imdbVotes?: string | null;    // e.g. "123,456"
  metascore?: string | null;    // e.g. "62"
  rottenTomatoes?: string | null; // e.g. "86%"
  fetchedAt: number;
};

type RatingsMap = Record<string, RatingEntry>; // generic key -> rating entry

const STORAGE_KEY = 'omdb_ratings_cache_v1';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// concurrency limiter
const MAX_CONCURRENT = 3;
const FETCH_DELAY_MS = 250; // polite gap between jobs

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

  // queue / concurrency bookkeeping
  const queue = useRef<string[]>([]);
  const queuedKeys = useRef<Set<string>>(new Set());
  const running = useRef(0);
  const mounted = useRef(true);
  const pendingPromises = useRef<Map<string, Promise<RatingEntry | null>>>(new Map());

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!mounted.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('Could not persist ratings cache', e);
    }
  }, [map]);

  function mapKeyForTmdb(mediaType: 'movie' | 'tv', tmdbId: number) {
    return `${mediaType}:${tmdbId}`;
  }

  // Episode key uses show IMDb id (because TMDB episode id doesn't map to OMDb)
  function mapKeyForEpisode(showImdbId: string, season: number, episode: number) {
    return `episode:${showImdbId}:S${season}E${episode}`;
  }

  function enqueueKey(key: string) {
    if (queuedKeys.current.has(key)) return;
    queuedKeys.current.add(key);
    queue.current.push(key);
    processQueue();
  }

  async function processQueue() {
    while (running.current < MAX_CONCURRENT && queue.current.length > 0) {
      const key = queue.current.shift();
      if (!key) break;
      queuedKeys.current.delete(key);
      running.current++;
      // don't await inside loop — start job concurrently but keep running count
      (async (k) => {
        try {
          const p = pendingPromises.current.get(k);
          if (p) {
            await p;
          } else {
            // nothing pending (should be rare); give a small tick
            await new Promise((r) => setTimeout(r, 0));
          }
        } catch (e) {
          console.error('processQueue job error', e);
        } finally {
          running.current--;
          // small gap before starting more
          await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
          if (mounted.current) processQueue();
        }
      })(key);
    }
  }

  // --------------------------
  // Public: getCached (sync)
  // --------------------------
  function getCached(mediaType: 'movie' | 'tv', tmdbId: number) {
    const key = mapKeyForTmdb(mediaType, tmdbId);
    return map[key] ?? null;
  }

  function getEpisodeCached(showImdbId: string, season: number, episode: number) {
    if (!showImdbId) return null;
    const key = mapKeyForEpisode(showImdbId, season, episode);
    return map[key] ?? null;
  }

  // --------------------------
  // Refresh helpers
  // --------------------------
  function refresh(mediaType: 'movie' | 'tv', tmdbId: number, force: boolean = false): Promise<RatingEntry | null> {
    const key = mapKeyForTmdb(mediaType, tmdbId);
    const existing = map[key];
    const now = Date.now();
    if (!force && existing && now - existing.fetchedAt < ttlMs) return Promise.resolve(existing);

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

        // Use OMDb by IMDb id (movie/show level)
        const url = `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(omdbApiKey)}`;
        const res = await fetch(url);
        if (!res.ok) {
          const entry: RatingEntry = { imdbId, fetchedAt: Date.now() };
          if (mounted.current) setMap((m) => ({ ...m, [key]: entry }));
          return entry;
        }
        const data = await res.json();
        const rt = (data.Ratings || []).find((r: any) => r.Source?.toLowerCase().includes('rotten'))?.Value ?? null;
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

  // Fetch episode-level rating via OMDb episode endpoint
  function refreshEpisode(showImdbId: string, season: number, episode: number, force: boolean = false): Promise<RatingEntry | null> {
    if (!showImdbId) return Promise.resolve(null);
    if (!omdbApiKey) return Promise.resolve(null);

    const key = mapKeyForEpisode(showImdbId, season, episode);
    const existing = map[key];
    const now = Date.now();
    if (!force && existing && now - existing.fetchedAt < ttlMs) return Promise.resolve(existing);

    const pending = pendingPromises.current.get(key);
    if (pending) return pending;

    const p = (async (): Promise<RatingEntry | null> => {
      try {
        // OMDb episode lookup: i=ttXXXXX&Season=1&Episode=2
        const url = `https://www.omdbapi.com/?i=${encodeURIComponent(showImdbId)}&Season=${encodeURIComponent(String(season))}&Episode=${encodeURIComponent(String(episode))}&apikey=${encodeURIComponent(omdbApiKey)}`;
        const res = await fetch(url);
        if (!res.ok) {
          const entry: RatingEntry = { imdbId: showImdbId, fetchedAt: Date.now() };
          if (mounted.current) setMap((m) => ({ ...m, [key]: entry }));
          return entry;
        }
        const data = await res.json();
        // If OMDb returns an error or no rating, keep a timestamped entry to avoid repeated failing calls
        if (data?.Error) {
          const entry: RatingEntry = { imdbId: showImdbId, fetchedAt: Date.now() };
          if (mounted.current) setMap((m) => ({ ...m, [key]: entry }));
          return entry;
        }

        const rt = (data.Ratings || []).find((r: any) => r.Source?.toLowerCase().includes('rotten'))?.Value ?? null;
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
        console.error('refreshEpisode failed', err);
        return null;
      } finally {
        pendingPromises.current.delete(key);
      }
    })();

    pendingPromises.current.set(key, p);
    enqueueKey(key);
    return p;
  }

  // Bulk ensure - used by home/search lists; for episode we don't bulk fetch unless you pass episode tuples
  function ensureForList(items: Array<{ media_type: 'movie' | 'tv'; id: number }>, maxToEnqueue = 10) {
    const now = Date.now();
    let enqueued = 0;
    for (const it of items) {
      if (enqueued >= maxToEnqueue) break;
      const key = mapKeyForTmdb(it.media_type, it.id);
      const existing = map[key];
      if (!existing || now - existing.fetchedAt >= ttlMs) {
        refresh(it.media_type, it.id, true).catch((e) => console.error('ensureForList refresh failed', e));
        enqueued++;
      }
    }
  }

  function clearCache() {
    if (mounted.current) setMap({});
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  return {
    // movie/show
    getCached,
    refresh,
    // episode
    getEpisodeCached,
    refreshEpisode,
    // bulk
    ensureForList,
    clearCache,
    rawMap: map,
  };
}