// src/utils/stremio.ts
// TRUE Stremio deep-link helpers (Android / Desktop App)

import { MediaDetail, EpisodeDetail } from '../types';

/**
 * Build Stremio deep link for MOVIES or FULL TV SERIES
 * Uses IMDb ID from TMDB external_ids (Cinemeta compatible)
 */
export function buildStremioMediaUrl(media: MediaDetail): string {
  const imdbId = media.external_ids?.imdb_id;
  const title = media.title || media.name || '';

  // ✅ Perfect case – direct open in Stremio app
  if (imdbId) {
    if (media.media_type === 'movie') {
      return `stremio:///detail/movie/${imdbId}/${imdbId}`;
    }

    if (media.media_type === 'tv') {
      return `stremio:///detail/series/${imdbId}/${imdbId}`;
    }
  }

  // ❌ Fallback – search if IMDb ID missing
  const year =
    media.release_date || media.first_air_date
      ? new Date(media.release_date || media.first_air_date || '').getFullYear()
      : '';

  const query = encodeURIComponent(`${title} ${year}`.trim());
  return `stremio:///search?search=${query}`;
}

/**
 * Build Stremio deep link for a SPECIFIC EPISODE
 * Format:
 * stremio:///detail/series/{imdbId}/{imdbId}:{season}:{episode}
 */
export function buildStremioEpisodeUrl(
  showImdbId: string | null | undefined,
  showTitle: string,
  seasonNumber: number,
  episodeNumber: number
): string {
  // ✅ Direct Episode Deep Link
  if (showImdbId) {
    return `stremio:///detail/series/${showImdbId}/${showImdbId}:${seasonNumber}:${episodeNumber}`;
  }

  // ❌ Fallback – episode search
  const s = String(seasonNumber).padStart(2, '0');
  const e = String(episodeNumber).padStart(2, '0');
  const query = encodeURIComponent(`${showTitle} S${s}E${e}`);

  return `stremio:///search?search=${query}`;
}