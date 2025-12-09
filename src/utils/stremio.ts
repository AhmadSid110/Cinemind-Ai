// src/utils/stremio.ts
import { MediaDetail } from '../types';

interface EpisodeContext {
  showTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

/**
 * Builds a Stremio Web/App-compatible search link.
 *
 * ✅ Movies: "Inception 2010"
 * ✅ Series: "Breaking Bad"
 * ✅ Episodes: "Breaking Bad S01E03"
 *
 * Opens:
 * https://app.strem.io/shell-v4.4/#/search?q=...
 */
export function buildStremioSearchUrl(
  media: MediaDetail | {
    title?: string;
    name?: string;
    media_type?: string;
    release_date?: string;
    first_air_date?: string;
    number_of_seasons?: number;
  },
  episode?: EpisodeContext
): string {
  const isTv =
    media.media_type === 'tv' ||
    !!media.number_of_seasons;

  const baseTitle = (
    episode?.showTitle ||
    media.title ||
    media.name ||
    ''
  ).trim();

  let query = baseTitle;

  // Add year for movies (improves matching)
  if (!isTv) {
    const rawDate = media.release_date || media.first_air_date;
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

  return `https://app.strem.io/shell-v4.4/#/search?q=${encodeURIComponent(query)}`;
}      '';
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
