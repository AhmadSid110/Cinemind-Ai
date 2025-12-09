// src/utils/stremio.ts

import type { MediaDetail } from '../types';

/**
 * Build a Stremio search deeplink.
 *
 * We purposely use the "search" scheme (no Cinemeta IDs required):
 *   stremio:///search?search={query}
 *
 * - Movies:  "Title 2014"
 * - Series:  "Title"
 */
export function buildStremioSearchLink(
  media: Pick<MediaDetail, 'title' | 'name' | 'media_type' | 'release_date' | 'first_air_date'>
): string {
  const isTv = media.media_type === 'tv';

  const baseTitle = (media.title || media.name || '').trim();
  if (!baseTitle) {
    // Safety fallback – won't crash if somehow title is missing
    return 'stremio:///search?search=';
  }

  let query = baseTitle;

  // For movies, appending the year helps Stremio pick the right match
  if (!isTv) {
    const rawDate = media.release_date || media.first_air_date || '';
    if (rawDate) {
      const year = new Date(rawDate).getFullYear();
      if (!Number.isNaN(year)) {
        query += ` ${year}`;
      }
    }
  }

  const encoded = encodeURIComponent(query);
  return `stremio:///search?search=${encoded}`;
}