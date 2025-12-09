// src/utils/stremio.ts

/**
 * Build Stremio links (app + web) using best-match search strings.
 *
 * Movies  →  "Inception 2010"
 * Series  →  "Rick and Morty"
 * Episode →  "Rick and Morty S03E04"
 */

interface BuildStremioQueryInput {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
}

/**
 * Create Stremio-compatible search query
 */
function buildQuery({
  title,
  year,
  season,
  episode,
}: BuildStremioQueryInput): string {
  let query = title.trim();

  // Append year (movies only)
  if (year && !season && !episode) {
    query += ` ${year}`;
  }

  // Append episode info
  if (season && episode) {
    const s = String(season).padStart(2, '0');
    const e = String(episode).padStart(2, '0');
    query += ` S${s}E${e}`;
  }

  return query;
}

/**
 * Generate BOTH app + web links
 */
export function getStremioLinks(input: BuildStremioQueryInput) {
  const query = buildQuery(input);
  const encoded = encodeURIComponent(query);

  return {
    // ✅ Android app deep-link
    app: `stremio://search?query=${encoded}`,

    // ✅ Correct Stremio web search
    web: `https://app.strem.io/shell-v4.4/#/search?q=${encoded}`,

    // Useful for debugging/logging
    query,
  };
}

/**
 * Try opening Stremio app, fallback to web
 */
export function openInStremio(input: BuildStremioQueryInput) {
  const { app, web } = getStremioLinks(input);

  // Try app first
  window.location.href = app;

  // Fallback to web if app not installed
  setTimeout(() => {
    window.open(web, '_blank', 'noopener,noreferrer');
  }, 700);
}