// src/utils/stremio.ts

/**
 * Options for simple Stremio search deeplink.
 *
 * - `title`  : required text (movie / show / episode title)
 * - `year`   : optional year to disambiguate movies
 * - `season` : optional season for episode-style queries
 * - `episode`: optional episode number for episode-style queries
 */
export interface StremioSearchOptions {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
}

/**
 * Build a Stremio **search** deeplink.
 *
 * Examples of generated queries:
 *  - "Interstellar 2014"
 *  - "Breaking Bad"
 *  - "Breaking Bad S01E01"
 *
 * URL form:
 *   stremio:///search?search={ENCODED_QUERY}
 */
export function buildStremioSearchUrl(opts: StremioSearchOptions): string {
  const parts: string[] = [];

  const baseTitle = (opts.title || '').trim();
  if (baseTitle) parts.push(baseTitle);

  // Add year for movies when available
  if (typeof opts.year === 'number' && !Number.isNaN(opts.year)) {
    parts.push(String(opts.year));
  }

  // If this looks like an episode, add SxxEyy suffix
  if (
    typeof opts.season === 'number' &&
    typeof opts.episode === 'number' &&
    opts.season > 0 &&
    opts.episode > 0
  ) {
    const s = String(opts.season).padStart(2, '0');
    const e = String(opts.episode).padStart(2, '0');
    parts.push(`S${s}E${e}`);
  }

  const query = parts.join(' ').trim() || ' ';
  const encoded = encodeURIComponent(query);

  // Custom scheme – should trigger the Stremio app on mobile/desktop
  return `stremio:///search?search=${encoded}`;
}

/**
 * Options for **detail** deeplink using Cinemeta mapping.
 *
 * - type    : "movie" or "series"
 * - imdbId  : IMDb ID like "tt0108778" (required for a true detail link)
 * - season  : optional season for series episodes
 * - episode : optional episode number for series episodes
 * - title/year/season/episode : used ONLY for fallback search if imdbId missing
 */
export interface StremioDetailOptions {
  type: 'movie' | 'series';
  imdbId?: string | null;
  season?: number;
  episode?: number;

  // Fallback metadata for search if imdbId is not available
  title?: string;
  year?: number;
}

/**
 * Build a Stremio **detail** deeplink if we have an IMDb ID.
 * Otherwise falls back to `buildStremioSearchUrl`.
 *
 * Examples:
 *  movie  : stremio:///detail/movie/tt0066921/tt0066921
 *  series : stremio:///detail/series/tt0108778/tt0108778:1:1
 */
export function buildStremioDetailUrl(opts: StremioDetailOptions): string {
  const imdbId = (opts.imdbId || '').trim();

  // If we don't have an IMDb id yet, fall back to a regular search link
  if (!imdbId) {
    return buildStremioSearchUrl({
      title: opts.title || '',
      year: opts.year,
      season: opts.season,
      episode: opts.episode,
    });
  }

  let videoId = imdbId;

  // For series episodes, append :season:episode as per Cinemeta docs
  if (
    opts.type === 'series' &&
    typeof opts.season === 'number' &&
    typeof opts.episode === 'number' &&
    opts.season > 0 &&
    opts.episode > 0
  ) {
    videoId = `${imdbId}:${opts.season}:${opts.episode}`;
  }

  return `stremio:///detail/${opts.type}/${imdbId}/${videoId}`;
}