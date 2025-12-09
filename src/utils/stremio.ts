// src/utils/stremio.ts

import type { MediaDetail } from '../types';

export interface StremioUrls {
  app: string; // stremio:/// deep link (opens the app)
  web: string; // https://app.strem.io/... fallback
}

const STREMIO_APP_SCHEME = 'stremio:///';
const STREMIO_WEB_BASE = 'https://app.strem.io/shell-v4.4/#';

/**
 * Normalise + encode a query or id.
 */
const enc = (s: string) => encodeURIComponent(s.trim());

/**
 * Extract a Cinemeta-compatible meta id from TMDB details.
 * Prefer IMDb id, fall back to TMDB id if nothing else.
 */
export const getCinemetaIdFromMedia = (media: Partial<MediaDetail>): string | null => {
  const imdb =
    (media as any)?.external_ids?.imdb_id ||
    (media as any)?.imdb_id;

  if (imdb && typeof imdb === 'string' && imdb.trim()) {
    return imdb.trim();
  }

  // Very soft fallback – some addons support tmdb: ids
  if (media.id) {
    return `tmdb:${media.media_type || 'movie'}:${media.id}`;
  }

  return null;
};

/**
 * Build Stremio search URLs – used as generic fallback.
 */
export const buildStremioSearchUrls = (query: string): StremioUrls => {
  const q = enc(query);
  return {
    app: `${STREMIO_APP_SCHEME}search?search=${q}`,
    web: `${STREMIO_WEB_BASE}/search?q=${q}`,
  };
};

/**
 * Detail page for a movie or series (no specific episode).
 */
export const buildStremioDetailUrlsForMedia = (
  media: MediaDetail
): StremioUrls | null => {
  const metaId = getCinemetaIdFromMedia(media);
  if (!metaId) return null;

  const type = media.media_type === 'tv' ? 'series' : 'movie';
  const idEnc = enc(metaId);

  return {
    app: `${STREMIO_APP_SCHEME}detail/${type}/${idEnc}/${idEnc}`,
    web: `${STREMIO_WEB_BASE}/detail/${type}/${idEnc}/${idEnc}`,
  };
};

/**
 * Episode-aware detail URL:
 *  series meta id = Cinemeta id (usually IMDb, e.g. tt0944947)
 *  video id       = `${metaId}:${season}:${episode}`
 *
 * Example:
 *  stremio:///detail/series/tt0108778/tt0108778:1:1
 */
export const buildStremioEpisodeUrls = (
  seriesMetaId: string | null | undefined,
  seasonNumber: number | undefined,
  episodeNumber: number | undefined
): StremioUrls | null => {
  if (!seriesMetaId || !seasonNumber || !episodeNumber) return null;

  const meta = seriesMetaId.trim();
  if (!meta) return null;

  const videoId = `${meta}:${seasonNumber}:${episodeNumber}`;

  const idEnc = enc(meta);
  const vidEnc = enc(videoId);

  return {
    app: `${STREMIO_APP_SCHEME}detail/series/${idEnc}/${vidEnc}`,
    web: `${STREMIO_WEB_BASE}/detail/series/${idEnc}/${vidEnc}`,
  };
};