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
 * Movies: "Title 2014"
 * Series: "Title"
 * Episodes: "Title S01E05"
 *
 * We use the same pattern Stremio uses on the web:
 *   https://app.strem.io/shell-v4.4/#/search?q=Rick%20and%20morty
 */
type MinimalMedia = {
  title?: string | null;
  name?: string | null;
  media_type?: string | null;
  first_air_date?: string | null;
  release_date?: string | null;
  number_of_seasons?: number | null;
} & Partial<MediaDetail>;

export function buildStremioSearchUrl(
  media: MinimalMedia,
  episode?: EpisodeContext
): string {
  const isTv =
    media.media_type === 'tv' ||
    !!media.number_of_seasons;

  const baseTitle =
    (episode?.showTitle ||
      media.title ||
      media.name ||
      '').trim();

  let query = baseTitle;

  // For movies, append year – helps Stremio pick the correct match
  if (!isTv) {
    const rawDate = media.release_date || media.first_air_date || '';
    if (rawDate) {
      const year = new Date(rawDate).getFullYear();
      if (!Number.isNaN(year)) {
        query += ` ${year}`;
      }
    }
  }

  // If we have episode info, append SxxEyy (Stremio understands this pattern)
  if (episode?.seasonNumber && episode?.episodeNumber) {
    const s = String(episode.seasonNumber).padStart(2, '0');
    const e = String(episode.episodeNumber).padStart(2, '0');
    query += ` S${s}E${e}`;
  }

  const encoded = encodeURIComponent(query);

  // This matches your working example:
  // https://app.strem.io/shell-v4.4/#/search?q=Rick%20and%20morty
  const webUrl = `https://app.strem.io/shell-v4.4/#/search?q=${encoded}`;

  return webUrl;
}