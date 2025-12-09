// src/utils/stremio.ts
import { MediaDetail } from '../types';

export interface EpisodeContext {
  showTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

/**
 * Build a Stremio search URL.
 *
 * Examples of the final URL we want:
 * https://app.strem.io/shell-v4.4/#/search?q=Rick%20and%20Morty
 *
 * - Movies: "Title 2014"
 * - Series: "Title"
 * - Episodes: "Title S01E05"
 */
export function buildStremioSearchUrl(
  media: Pick<
    MediaDetail,
    'title' | 'name' | 'media_type' | 'release_date' | 'first_air_date' | 'number_of_seasons'
  >,
  episode?: EpisodeContext
): string {
  const isTv =
    media.media_type === 'tv' ||
    !!media.number_of_seasons;

  const baseTitle = (episode?.showTitle || media.title || media.name || '').trim();

  let query = baseTitle;

  // For movies, appending year helps Stremio pick the right match
  if (!isTv) {
    const rawDate = media.release_date || media.first_air_date || '';
    if (rawDate) {
      const year = new Date(rawDate).getFullYear();
      if (!Number.isNaN(year)) {
        query += ` ${year}`;
      }
    }
  }

  // Episode-aware: SxxEyy
  if (episode?.seasonNumber && episode?.episodeNumber) {
    const s = String(episode.seasonNumber).padStart(2, '0');
    const e = String(episode.episodeNumber).padStart(2, '0');
    query += ` S${s}E${e}`;
  }

  const encoded = encodeURIComponent(query);

  // ✅ This matches the URL you confirmed works:
  // https://app.strem.io/shell-v4.4/#/search?q=Rick%20and%20morty
  return `https://app.strem.io/shell-v4.4/#/search?q=${encoded}`;
}