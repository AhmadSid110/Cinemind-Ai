// src/utils/stremio.ts

/**
 * Optional extra context when coming from an episode (season/episode numbers).
 */
export interface EpisodeContext {
  showTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

/**
 * Build a Stremio deep-link search URL.
 *
 * - Movies: "Title 2014"
 * - Series: "Title"
 * - Episodes: "Title S01E05"
 *
 * Uses the stremio:/// URI so Android can open the Stremio app directly.
 */
export function buildStremioSearchUrl(
  media: {
    title?: string;
    name?: string;
    media_type?: string;
    release_date?: string;
    first_air_date?: string;
  },
  episode?: EpisodeContext
): string {
  const isTv =
    media.media_type === 'tv' ||
    media.media_type === 'series' ||
    !!media.first_air_date;

  const baseTitle = (episode?.showTitle || media.title || media.name || '').trim();

  if (!baseTitle) {
    // Fallback to generic Stremio home if title is missing
    return 'stremio:///';
  }

  let query = baseTitle;

  // For movies, append year to help Stremio pick the right title
  if (!isTv) {
    const rawDate = media.release_date || media.first_air_date || '';
    if (rawDate) {
      const year = new Date(rawDate).getFullYear();
      if (!Number.isNaN(year)) {
        query += ` ${year}`;
      }
    }
  }

  // If we have an episode context, append SxxEyy
  if (episode?.seasonNumber && episode?.episodeNumber) {
    const s = String(episode.seasonNumber).padStart(2, '0');
    const e = String(episode.episodeNumber).padStart(2, '0');
    query += ` S${s}E${e}`;
  }

  const encoded = encodeURIComponent(query);

  // Deep link that should trigger the Stremio app on Android
  return `stremio:///search?search=${encoded}`;
}