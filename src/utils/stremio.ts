// src/utils/stremio.ts
export type StremioMediaType = 'movie' | 'tv';

interface StremioSearchOptions {
  type: StremioMediaType;
  title: string;
  year?: number | string;
  season?: number;
  episode?: number;
}

/**
 * Builds a best-effort Stremio search URL.
 * For movies:   "Title (Year)"
 * For episodes: "Title S01E05"
 */
export function buildStremioSearchUrl(opts: StremioSearchOptions): string {
  const { type, title, year, season, episode } = opts;

  if (!title) return 'https://www.stremio.com';

  let query = title.trim();

  // Append year for movies (helps disambiguate)
  if (type === 'movie' && year) {
    query += ` (${year})`;
  }

  // Append season/episode for TV if available
  if (type === 'tv' && season && episode) {
    const s = season.toString().padStart(2, '0');
    const e = episode.toString().padStart(2, '0');
    query += ` S${s}E${e}`;
  }

  // Most Stremio setups understand either stremio:// or a web search.
  // We'll go with a generic web search URL that users can still use
  // even if the custom protocol isn't registered.
  const encoded = encodeURIComponent(query);

  // If you know your Stremio URI scheme, you can change this to:
  // return `stremio://search?query=${encoded}`;
  return `https://www.stremio.com/search?query=${encoded}`;
}
