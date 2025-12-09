// src/utils/stremio.ts

import { MediaDetail } from '../types';

export interface EpisodeContext {
  showTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

/**
 * Detect if we are likely running on Android (for better deep-linking).
 * This is runtime-checked so it won't break builds.
 */
function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

/**
 * Build a web URL that opens Stremio in the browser.
 * Example: https://app.strem.io/shell-v4.4/#/search?q=Rick%20and%20Morty
 */
function buildWebSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://app.strem.io/shell-v4.4/#/search?q=${encoded}`;
}

/**
 * Build an app deep-link URL for Stremio search.
 * Example: stremio:///search?search=Rick%20and%20Morty
 */
function buildDeepSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `stremio:///search?search=${encoded}`;
}

/**
 * Extract a "base title" from a media-like object or explicit context.
 */
function getBaseTitle(
  media: Partial<{
    title: string;
    name: string;
  }>,
  episode?: EpisodeContext
): string {
  const fromEpisode = episode?.showTitle?.trim();
  if (fromEpisode) return fromEpisode;

  const fromMedia = (media.title || media.name || '').trim();
  return fromMedia;
}

/**
 * Extract a year for movies/series when we want to help Stremio disambiguate.
 */
function getYear(
  media: Partial<{
    year: number;
    release_date: string;
    first_air_date: string;
  }>
): number | undefined {
  if (typeof media.year === 'number') return media.year;

  const raw =
    (media.release_date && media.release_date.trim()) ||
    (media.first_air_date && media.first_air_date.trim()) ||
    '';

  if (!raw) return undefined;

  const y = new Date(raw).getFullYear();
  return Number.isNaN(y) ? undefined : y;
}

/**
 * Build a search query string for Stremio:
 *  - Movies: "Title 2014"
 *  - Series: "Title"
 *  - Episodes: "Title S01E05"
 */
function buildSearchQuery(
  media: Partial<{
    title: string;
    name: string;
    media_type: string;
    release_date: string;
    first_air_date: string;
    year: number;
    number_of_seasons: number;
  }>,
  episode?: EpisodeContext
): string {
  const baseTitle = getBaseTitle(media, episode);
  if (!baseTitle) return '';

  const isTv =
    media.media_type === 'tv' ||
    typeof media.number_of_seasons === 'number';

  let query = baseTitle;

  // For movies, append year when we have it (helps Stremio pick correct match)
  if (!isTv) {
    const year = getYear(media);
    if (year) query += ` ${year}`;
  }

  // For episode-aware searches, append SxxEyy
  if (episode?.seasonNumber && episode?.episodeNumber) {
    const s = String(episode.seasonNumber).padStart(2, '0');
    const e = String(episode.episodeNumber).padStart(2, '0');
    query += ` S${s}E${e}`;
  }

  return query;
}

/**
 * Public helper used by DetailView and (optionally) EpisodeDetailView.
 *
 * It will:
 *  - Build the best possible text query
 *  - Use a stremio:/// deep-link on Android (so the app can open directly)
 *  - Use the HTTPS web URL elsewhere (desktop / non-Android browsers)
 *
 * Usage examples:
 *  buildStremioSearchUrl({ title: "Inception", year: 2010 })
 *  buildStremioSearchUrl(mediaDetail)
 *  buildStremioSearchUrl(mediaDetail, { seasonNumber: 1, episodeNumber: 5 })
 */
export function buildStremioSearchUrl(
  media: Partial<{
    title: string;
    name: string;
    media_type: string;
    release_date: string;
    first_air_date: string;
    year: number;
    number_of_seasons: number;
  }>,
  episode?: EpisodeContext
): string {
  const query = buildSearchQuery(media, episode) || 'Stremio';
  // Use custom scheme on Android, web URL otherwise
  return isAndroid() ? buildDeepSearchUrl(query) : buildWebSearchUrl(query);
}

/* ------------------------------------------------------------------ */
/*            OPTIONAL: CINEMETA-BASED DEEP LINK HELPERS              */
/*   (You can use these later if you want true /detail/{...} links)   */
/* ------------------------------------------------------------------ */

/**
 * Extract Cinemeta meta ID from TMDB MediaDetail.
 * For Cinemeta, this is usually the IMDb ID (e.g. "tt0108778").
 */
export function getCinemetaId(media: MediaDetail): string | null {
  const imdbId = (media as any)?.external_ids?.imdb_id;
  if (typeof imdbId === 'string' && imdbId.trim()) {
    return imdbId.trim();
  }
  return null;
}

/**
 * Build a Stremio detail deep-link:
 *   stremio:///detail/{type}/{id}/{videoId}?autoPlay={autoPlay}
 *
 * Examples (from Stremio docs):
 *   stremio:///detail/movie/tt0066921/tt0066921
 *   stremio:///detail/series/tt0108778/tt0108778:1:1
 *
 * NOTE:
 * - Requires a Cinemeta ID (usually IMDb ID).
 * - If we can't determine one, this returns null. In that case, use search.
 */
export function buildStremioDetailUrl(
  media: MediaDetail,
  episode?: EpisodeContext,
  options?: { autoPlay?: boolean }
): string | null {
  const cineId = getCinemetaId(media);
  if (!cineId) return null;

  const type = media.media_type === 'tv' ? 'series' : 'movie';

  let videoId = cineId;
  if (
    type === 'series' &&
    episode?.seasonNumber &&
    episode?.episodeNumber
  ) {
    videoId = `${cineId}:${episode.seasonNumber}:${episode.episodeNumber}`;
  }

  const autoPlay = options?.autoPlay ?? (type === 'movie');

  return `stremio:///detail/${type}/${encodeURIComponent(
    cineId
  )}/${encodeURIComponent(videoId)}?autoPlay=${autoPlay ? 'true' : 'false'}`;
}

/**
 * Convenience helper:
 * - Try to build a Cinemeta-based deep link
 * - If that fails, fall back to text search
 */
export function buildBestStremioUrl(
  media: MediaDetail,
  episode?: EpisodeContext
): string {
  const detailUrl = buildStremioDetailUrl(media, episode);
  if (detailUrl) return detailUrl;
  return buildStremioSearchUrl(media, episode);
}