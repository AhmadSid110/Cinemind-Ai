// src/utils/stremio.ts

import { MediaDetail } from '../types';

interface EpisodeContext {
  showTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

/**
 * Build a Stremio search URL.
 * - Movies: "Title 2014"
 * - Series: "Title"
 * - Episodes: "Title S01E05"
 */
export function buildStremioSearchUrl(
  media: MediaDetail | { title?: string; name?: string; media_type?: string; first_air_date?: string; release_date?: string },
  episode?: EpisodeContext
): string {
  const isTv =
    (media as any).media_type === 'tv' ||
    !!(media as any).number_of_seasons;

  const baseTitle =
    (episode?.showTitle ||
      (media as any).title ||
      (media as any).name ||
      '').trim();

  // Try to append year for movies (helps Stremio pick correct match)
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

  // If we have episode info, append SxxEyy
  if (episode?.seasonNumber && episode?.episodeNumber) {
    const s = String(episode.seasonNumber).padStart(2, '0');
    const e = String(episode.episodeNumber).padStart(2, '0');
    query += ` S${s}E${e}`;
  }

  const encoded = encodeURIComponent(query);

  // This is the important part – hash route + search param
  return `https://app.strem.io/shell-v4#/search?search=${encoded}`;
}