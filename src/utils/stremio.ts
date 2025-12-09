// src/utils/stremio.ts
export interface StremioSearchOptions {
  title: string;
  year?: number | string;
  season?: number;
  episode?: number;
}

/**
 * Build a Stremio web-app search URL.
 * This works in any browser and will open the Stremio web UI.
 * If the native app is registered for app.strem.io on the device,
 * the OS may offer to open it there.
 */
export function buildStremioSearchUrl({
  title,
  year,
  season,
  episode,
}: StremioSearchOptions): string {
  // "Best possible" query string
  let q = title.trim();
  if (year) q += ` ${year}`;
  if (season) q += ` S${String(season).padStart(2, '0')}`;
  if (episode) q += `E${String(episode).padStart(2, '0')}`;

  return `https://app.strem.io/shell-v4.4/#/search?search=${encodeURIComponent(
    q,
  )}`;
}
