// src/hooks/useRatingsCache.ts
import { useEffect, useRef, useState } from 'react';
import { fetchOmdbByImdbId, OmdbRating } from '../services/omdbService';
import * as tmdb from '../services/tmdbService';

type RatingEntry = {
  imdbId?: string | null;
  imdbRating?: string | null;   // "7.8"
  imdbVotes?: string | null;    // "123,456"
  metascore?: string | null;    // "62"
  rottenTomatoes?: string | null; // "86%"
  fetchedAt: number;
};

type RatingsMap = Record<string, RatingEntry>; // key: `${media_type}:${tmdbId}`

const STORAGE_KEY = 'omdb_ratings_cache_v1';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// concurrency limiter
const MAX_CONCURRENT = 3;
const FETCH_DELAY_MS = 250; // polite small delay between queued calls

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

  // queue for keys to refresh
  const queue = useRef<string[]>([]);
  const queuedKeys = useRef<Set<string>>(new Set()); // avoid duplicate enqueue
  const running = useRef(0);
  const mounted = useRef(true);

  // prevent duplicate concurrent refreshes for same key:
  const pendingPromises = useRef<Map<string, Promise<RatingEntry | null>>>(new Map());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // persist on change (only while mounted)
  useEffect(() => {
    if (!mounted.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('Could not persist ratings cache', e);
    }
  }, [map]);

  // helper key
  const mapKey = (mediaType: 'movie' | 'tv', tmdbId: number) => `${mediaType}:${tmdbId}`;

  // internal: schedule a key (mediaType:tmdbId)
  function enqueueKey(key: string, work: () => Promise<void>) {
    if (queuedKeys.current.has(key)) return;
    queuedKeys.current.add(key);
    queue.current.push(key);
    // map key -> job function by storing in pendingPromises when refresh called
    processQueue();
  }

  async function processQueue() {
    // while we have capacity and queue items, start them
    while (running.current < MAX_CONCURRENT && queue.current.length > 0) {
      const key = queue.current.shift();
      if (!key) break;
      queuedKeys.current.delete(key); // it's being processed now
      running.current++;
      // small delay so we don't hammer
      // Note: we intentionally don't await here to allow multiple concurrent
      (async (k) => {
        try {
          // If a pending promise exists, await it (dedupe)
          const existing = pendingPromises.current.get(k);
          if (existing) {
            await existing;
            return;
          }
          // else nothing to do because refresh() itself will populate pendingPromises
          // but to be safe we just wait a tick
          await new Promise((r) => setTimeout(r, 0));
        } catch (e) {
          console.error('processQueue job error', e);
        } finally {
          running.current--;
          // polite gap between starting new jobs
          await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
          // continue processing
          if (mounted.current) processQueue();
        }
      })(key);
    }
  }

  // Public API: get cached (sync)
  function getCached(mediaType: 'movie' | 'tv', tmdbId: number) {
    const key = mapKey(mediaType, tmdbId);
    return map[key] ?? null;
  }

  // Force refresh for item (background). returns promise that resolves when done.
  function refresh(mediaType: 'movie' | 'tv', tmdbId: number, force: boolean = false): Promise<RatingEntry | null> {
    const key = mapKey(mediaType, tmdbId);
    const existing = map[key];
    const now = Date.now();
    if (!force && existing && now - existing.fetchedAt < ttlMs) {
      return Promise.resolve(existing);
    }

    // If a refresh for this key is already in-flight, return that promise
    const pending = pendingPromises.current.get(key);
    if (pending) return pending;

    // Create a promise and store it so other callers can await
    const p = (async (): Promise<RatingEntry | null> => {
      try {
        // 1) fetch external ids (imdb)
        // make sure tmdbApiKey is present
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

        // fetch from OMDb by imdb id. Your fetchOmdbByImdbId should handle 429/backoff.
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

    // enqueue key so processQueue picks it up (it may be no-op if work already done)
    enqueueKey(key, async () => {
      try {
        await p;
      } catch (e) {
        // ignore
      }
    });

    return p;
  }

  // Bulk ensure - used when you have a list (home feed). This queues items to be refreshed
  // but avoids re-queueing duplicates; returns void (background)
  function ensureForList(items: Array<{ media_type: 'movie' | 'tv'; id: number }>, maxToEnqueue = 10) {
    const now = Date.now();
    let enqueued = 0;
    for (const it of items) {
      if (enqueued >= maxToEnqueue) break;
      const key = mapKey(it.media_type, it.id);
      const existing = map[key];
      if (!existing || now - existing.fetchedAt >= ttlMs) {
        // schedule a refresh (force = true) — but do not create too many simultaneous
        refresh(it.media_type, it.id, true).catch((e) => {
          console.error('ensureForList refresh failed', e);
        });
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

  // Expose raw map for debugging / UI
  return {
    getCached,
    refresh,
    ensureForList,
    clearCache,
    rawMap: map,
  };
}