// src/hooks/useRatingsCache.ts
import { useEffect, useRef, useState } from 'react';
import { fetchOmdbByImdbId, OmdbRating } from '../services/omdbService';
import * as tmdb from '../services/tmdbService';

type RatingEntry = {
  imdbId?: string | null;
  imdbRating?: string | null;   // "7.8"
  imdbVotes?: string | null;
  metascore?: string | null;    // string "62"
  rottenTomatoes?: string | null; // "86%"
  fetchedAt: number;
};

type RatingsMap = Record<string, RatingEntry>; // key: `${media_type}:${tmdbId}`

const STORAGE_KEY = 'omdb_ratings_cache_v1';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// concurrency limiter
const MAX_CONCURRENT = 3;
const FETCH_DELAY_MS = 350; // small delay between queued calls

export function useRatingsCache({ tmdbApiKey, omdbApiKey, ttlMs = DEFAULT_TTL_MS }: { tmdbApiKey: string; omdbApiKey?: string | null; ttlMs?: number }) {
  const [map, setMap] = useState<RatingsMap>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as RatingsMap) : {};
    } catch {
      return {};
    }
  });

  const queue = useRef<Array<() => Promise<void>>>([]);
  const running = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // persist on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('Could not persist ratings cache', e);
    }
  }, [map]);

  function enqueue(fn: () => Promise<void>) {
    queue.current.push(fn);
    processQueue();
  }

  async function processQueue() {
    if (running.current >= MAX_CONCURRENT) return;
    const job = queue.current.shift();
    if (!job) return;
    running.current++;
    try {
      await job();
    } catch (e) {
      console.error('ratings job error', e);
    } finally {
      running.current--;
      // small delay between jobs to be polite
      setTimeout(processQueue, FETCH_DELAY_MS);
    }
  }

  // key helper
  const mapKey = (mediaType: 'movie' | 'tv', tmdbId: number) => `${mediaType}:${tmdbId}`;

  // Public API: get rating (fast) — returns cached value and triggers refresh if stale
  function getCached(mediaType: 'movie' | 'tv', tmdbId: number) {
    const key = mapKey(mediaType, tmdbId);
    return map[key] ?? null;
  }

  // Force refresh for item (background). returns promise that resolves when done.
  function refresh(mediaType: 'movie' | 'tv', tmdbId: number, force: boolean = false) {
    const key = mapKey(mediaType, tmdbId);
    const existing = map[key];
    const now = Date.now();
    if (!force && existing && now - existing.fetchedAt < ttlMs) {
      // not stale
      return Promise.resolve(existing);
    }

    // queue work
    return new Promise<RatingEntry | null>((resolve) => {
      enqueue(async () => {
        try {
          // 1) get external ids (IMDB / TVDB)
          const ext = await tmdb.getExternalIds(tmdbApiKey, mediaType, tmdbId);
          const imdbId = ext?.imdb_id || null;
          if (!imdbId || !omdbApiKey) {
            // store minimal record (timestamp) to avoid repeated failing calls
            const entry: RatingEntry = { imdbId: imdbId ?? null, fetchedAt: Date.now() };
            setMap((m) => ({ ...m, [key]: entry }));
            resolve(entry);
            return;
          }

          const data = await fetchOmdbByImdbId(imdbId, omdbApiKey);
          if (!data) {
            const entry: RatingEntry = { imdbId, fetchedAt: Date.now() };
            setMap((m) => ({ ...m, [key]: entry }));
            resolve(entry);
            return;
          }

          const rt = (data.Ratings || []).find((r) => r.Source.toLowerCase().includes('rotten'))?.Value ?? null;
          const metascore = data.Metascore ?? null;
          const entry: RatingEntry = {
            imdbId,
            imdbRating: data.imdbRating ?? null,
            imdbVotes: data.imdbVotes ?? null,
            metascore,
            rottenTomatoes: rt,
            fetchedAt: Date.now(),
          };
          setMap((m) => ({ ...m, [key]: entry }));
          resolve(entry);
        } catch (err) {
          console.error('refresh rating failed', err);
          resolve(null);
        }
      });
    });
  }

  // Bulk ensure - used when you have a list (home feed)
  function ensureForList(items: Array<{ media_type: 'movie' | 'tv'; id: number }>, maxToEnqueue = 10) {
    // enqueue only items missing or stale; limit the number to avoid burst
    const now = Date.now();
    let enqueued = 0;
    items.forEach((it) => {
      if (enqueued >= maxToEnqueue) return;
      const key = mapKey(it.media_type, it.id);
      const existing = map[key];
      if (!existing || now - existing.fetchedAt >= ttlMs) {
        // enqueue refresh
        enqueue(() => refresh(it.media_type, it.id, true).then(()=>{}));
        enqueued++;
      }
    });
  }

  function clearCache() {
    setMap({});
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    getCached,
    refresh,
    ensureForList,
    clearCache,
    rawMap: map,
  };
}