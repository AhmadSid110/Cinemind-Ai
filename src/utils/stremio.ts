// src/utils/stremio.ts

import { MediaDetail } from '../types';

export interface EpisodeContext {
  showTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

// This matches the URL format that works in your screenshot:
// https://app.strem.io/shell-v4.4/#/search?q=Rick%20and%20morty
const STREMIO_BASE = 'https://app.strem.io/shell-v4.4/#/search?q=';

/**
 * Build a Stremio search URL.
 * - Movies:  "Title 2014"
 * - Series:  "Title"
 * - Episodes: "Title S01E05"
 */
export function buildStremioSearchUrl(
  media:
    | MediaDetail
    | {
        title?: string;
        name?: string;
        media_type?: string;
        first_air_date?: string;
        release_date?: string;
        number_of_seasons?: number;
      },
  episode?: EpisodeContext
): string {
  // Detect if this is a TV show
  const isTv =
    (media as any).media_type === 'tv' ||
    Boolean((media as any).number_of_seasons);

  // Prefer explicit showTitle (for episodes), then title/name
  const baseTitle =
    (episode?.showTitle ||
      (media as any).title ||
      (media as any).name ||
      '').trim();

  // If somehow we have no title, just open Stremio home
  if (!baseTitle) {
    return 'https://app.strem.io/shell-v4.4/#/';
  }

  let query = baseTitle;

  // For movies, append release year to help Stremio pick the right one
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

  // For episodes, append SxxEyy pattern
  if (episode?.seasonNumber && episode?.episodeNumber) {
    const s = String(episode.seasonNumber).padStart(2, '0');
    const e = String(episode.episodeNumber).padStart(2, '0');
    query += ` S${s}E${e}`;
  }

  const encoded = encodeURIComponent(query);
  return `${STREMIO_BASE}${encoded}`;
}