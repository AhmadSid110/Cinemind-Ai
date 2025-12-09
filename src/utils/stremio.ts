// src/utils/stremio.ts

/**
 * Context for a movie or series in Stremio.
 * We try Cinemeta-style IDs first (imdb / tvdb),
 * and fall back to a plain search deep link.
 */

export interface StremioMediaContext {
  title: string;
  year?: number;
  type: 'movie' | 'series';
  imdbId?: string | null;
  tvdbId?: number | null;
}

/**
 * Context for a specific episode of a series.
 */
export interface StremioEpisodeContext extends StremioMediaContext {
  season: number;
  episode: number;
}

/**
 * Helper: build Cinemeta meta ID from imdb / tvdb.
 * - If imdb id exists -> use it directly (e.g. "tt0108778")
 * - Else if tvdb id exists -> use "tvdb:{id}"
 * - Else return null (we'll fall back to search).
 */
const buildMetaId = (ctx: {
  imdbId?: string | null;
  tvdbId?: number | null;
}): string | null => {
  if (ctx.imdbId && ctx.imdbId.trim()) {
    return ctx.imdbId.trim();
  }
  if (typeof ctx.tvdbId === 'number') {
    return `tvdb:${ctx.tvdbId}`;
  }
  return null;
};

/**
 * Helper: build a human search query, used as fallback
 * when we don't have a meta ID.
 */
const buildSearchQuery = (ctx: {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
}): string => {
  let q = ctx.title.trim();

  if (ctx.year) {
    q += ` ${ctx.year}`;
  }

  if (ctx.season && ctx.episode) {
    const s = String(ctx.season).padStart(2, '0');
    const e = String(ctx.episode).padStart(2, '0');
    q += ` S${s}E${e}`;
  }

  return q;
};

/**
 * Build a **deep link** for a movie OR series.
 *
 * - If we have a Cinemeta meta ID -> use stremio:///detail/...
 * - Else fall back to stremio:///search?search=...
 */
export const buildStremioMediaUrl = (ctx: StremioMediaContext): string => {
  const metaId = buildMetaId(ctx);

  if (metaId) {
    const typePath = ctx.type === 'movie' ? 'movie' : 'series';
    const videoId = metaId; // show movie or series page
    return `stremio:///detail/${typePath}/${encodeURIComponent(
      metaId
    )}/${encodeURIComponent(videoId)}?autoPlay=false`;
  }

  // Fallback – search by title + year
  const query = buildSearchQuery({
    title: ctx.title,
    year: ctx.year,
  });

  return `stremio:///search?search=${encodeURIComponent(query)}`;
};

/**
 * Build a **deep link for a specific episode**.
 *
 * - If we have meta ID -> videoId = "{metaId}:{season}:{episode}"
 * - Else fall back to a season/episode search.
 */
export const buildStremioEpisodeUrl = (
  ctx: StremioEpisodeContext
): string => {
  const metaId = buildMetaId(ctx);

  if (metaId) {
    const typePath = 'series';
    const videoId = `${metaId}:${ctx.season}:${ctx.episode}`;
    return `stremio:///detail/${typePath}/${encodeURIComponent(
      metaId
    )}/${encodeURIComponent(videoId)}?autoPlay=false`;
  }

  // Fallback – series title + SxxEyy
  const query = buildSearchQuery({
    title: ctx.title,
    year: ctx.year,
    season: ctx.season,
    episode: ctx.episode,
  });

  return `stremio:///search?search=${encodeURIComponent(query)}`;
};