// src/utils/stremio.ts

import { MediaDetail } from '../types';

export interface EpisodeContext {
  showTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

/**
 * Minimal shape we need from media.
 * Works with full MediaDetail OR a lightweight object
 * like { title, name, media_type, release_date, first_air_date }.
 */
type StremioMediaLike =
  | MediaDetail
  | {
      title?: string;
      name?: string;
      media_type?: string;
      release_date?: string;
      first_air_date?: string;
      number_of_seasons?: number;
      external_ids?: {
        imdb_id?: string | null;
      };
    };

/**
 * Build a Stremio deep link using Cinemeta mapping when possible.
 *
 * Priority:
 * 1. If IMDb id exists:
 *    - movie:  stremio:///detail/movie/<imdb>/<imdb>
 *    - series: stremio:///detail/series/<imdb>/<imdb>[:season:episode]
 * 2. Fallback: search deep link
 *    stremio:///search?search=<query>
 *
 * This is intentionally named buildStremioSearchUrl to stay compatible
 * with existing imports/usages. Under the hood it now prefers detail links.
 */
export function buildStremioSearchUrl(
  media: StremioMediaLike,
  episode?: EpisodeContext
): string {
  // ---- 1. Type / basic info detection ----
  const isTv =
    (media as any).media_type === 'tv' ||
    !!(media as any).number_of_seasons;

  const baseTitle =
    (episode?.showTitle ||
      (media as any).title ||
      (media as any).name ||
      ''
    ).trim();

  // Safe guard: if we somehow have no title, don't crash
  const safeTitle = baseTitle || 'Unknown';

  // ---- 2. Try Cinemeta mapping via IMDb ID ----
  const imdbId: string | undefined =
    (media as any)?.external_ids?.imdb_id || undefined;

  if (imdbId) {
    const encImdb = encodeURIComponent(imdbId);

    // TV (series)
    if (isTv) {
      // If we have episode context, build series + episode videoId => imdb:season:episode
      if (episode?.seasonNumber && episode?.episodeNumber) {
        const videoId = `${imdbId}:${episode.seasonNumber}:${episode.episodeNumber}`;
        const encVideoId = encodeURIComponent(videoId);
        // autoPlay=false for safety – user chooses stream inside Stremio
        return `stremio:///detail/series/${encImdb}/${encVideoId}?autoPlay=false`;
      }

      // Only series meta (no specific episode)
      return `stremio:///detail/series/${encImdb}/${encImdb}`;
    }

    // Movies
    return `stremio:///detail/movie/${encImdb}/${encImdb}`;
  }

  // ---- 3. Fallback: search-style deep link ----
  let query = safeTitle;

  // For movies, appending year helps Stremio pick correct title
  if (!isTv) {
    const rawDate =
      (media as any).release_date ||
      (media as any).first_air_date ||
      '';
    if (rawDate) {
      const year = new Date(rawDate).getFullYear();
      if (!Number.isNaN(year)) {
        query += ` ${year}`;
      }
    }
  }

  // If we have episode info, append SxxEyy for better TV matching
  if (episode?.seasonNumber && episode?.episodeNumber) {
    const s = String(episode.seasonNumber).padStart(2, '0');
    const e = String(episode.episodeNumber).padStart(2, '0');
    query += ` S${s}E${e}`;
  }

  const encoded = encodeURIComponent(query);
  return `stremio:///search?search=${encoded}`;
}

/**
 * Optional helper:
 * Web fallback URL (opens Stremio web shell in browser).
 * Only use if you specifically want web, not the app.
 */
export function buildStremioWebSearchUrl(
  media: StremioMediaLike,
  episode?: EpisodeContext
): string {
  const isTv =
    (media as any).media_type === 'tv' ||
    !!(media as any).number_of_seasons;

  const baseTitle =
    (episode?.showTitle ||
      (media as any).title ||
      (media as any).name ||
      ''
    ).trim() || 'Unknown';

  let query = baseTitle;

  if (!isTv) {
    const rawDate =
      (media as any).release_date ||
      (media as any).first_air_date ||
      '';
    if (rawDate) {
      const year = new Date(rawDate).getFullYear();
      if (!Number.isNaN(year)) {
        query += ` ${year}`;
      }
    }
  }

  if (episode?.seasonNumber && episode?.episodeNumber) {
    const s = String(episode.seasonNumber).padStart(2, '0');
    const e = String(episode.episodeNumber).padStart(2, '0');
    query += ` S${s}E${e}`;
  }

  const encoded = encodeURIComponent(query);
  return `https://app.strem.io/shell-v4.4/#/search?q=${encoded}`;
}