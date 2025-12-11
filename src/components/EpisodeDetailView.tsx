// src/components/EpisodeDetailView.tsx
import React, { useMemo, useState } from 'react';
import { X, Star, Calendar, Tv } from 'lucide-react';
import { EpisodeDetail, Review } from '../types';
import {
  buildStremioEpisodeUrl,
  StremioEpisodeContext,
} from '../utils/stremio';

interface EpisodeDetailViewProps {
  episode: EpisodeDetail;
  showTitle?: string;
  onClose: () => void;
  onRate?: (id: string, rating: number) => void;
  userRating?: number;
  ratingsCache?: any; // ratingsCache interface is implementation-specific
  useOmdbRatings?: boolean;
}

const EpisodeDetailView: React.FC<EpisodeDetailViewProps> = ({
  episode,
  showTitle,
  onClose,
  onRate,
  userRating,
  ratingsCache,
  useOmdbRatings = true,
}) => {
  const [starsExpanded, setStarsExpanded] = useState<boolean>(false);

  // safe air year
  const airYear = episode.air_date
    ? new Date(episode.air_date).getFullYear()
    : undefined;

  const reviews: Review[] = episode.reviews?.results || [];

  const tmdbRating =
    typeof episode.vote_average === 'number'
      ? episode.vote_average.toFixed(1)
      : undefined;

  // === Parent series identifiers (robust lookups) ===
  // App.tsx should inject show_imdb_id/show_tvdb_id/show_name where possible.
  // Also accept alternative prop names that might exist on the episode object.
  const seriesImdbId: string | undefined =
    (episode as any).show_imdb_id ??
    (episode as any).show?.external_ids?.imdb_id ??
    (episode as any).show?.imdb_id ??
    (episode as any).imdb_id ??
    undefined;

  const seriesTmdbId: number | undefined =
    (episode as any).show_id ??
    (episode as any).tv_id ??
    (episode as any).series_id ??
    (episode as any).show?.id ??
    undefined;

  const seriesTvdbId: number | undefined =
    (episode as any).show_tvdb_id ??
    (episode as any).show?.external_ids?.tvdb_id ??
    undefined;

  // Build Stremio episode deep link
  const stremioEpisodeCtx: StremioEpisodeContext = {
    title: showTitle || episode.name || '',
    year: airYear,
    type: 'series',
    imdbId: seriesImdbId ?? null,
    tvdbId: seriesTvdbId ?? null,
    season: episode.season_number,
    episode: episode.episode_number,
  };

  const stremioEpisodeUrl = buildStremioEpisodeUrl(stremioEpisodeCtx);

  // Try to read cached OMDb / ratings data for the parent series (if available).
  // RatingsCache implementation (useRatingsCache hook) should expose getCached(mediaType, tmdbId)
  // and/or getCachedByImdbId(imdbId). We try several fallbacks.
  const cachedSeriesRating = useMemo(() => {
    if (!useOmdbRatings || !ratingsCache) return null;

    // Prefer TMDB id cached by ('tv', id)
    if (seriesTmdbId) {
      try {
        const c = ratingsCache.getCached?.('tv', seriesTmdbId);
        if (c) return c;
      } catch (e) {
        // ignore
      }
    }

    // Fallback: if we have an imdb id cached by imdb
    if (seriesImdbId) {
      try {
        const c2 = ratingsCache.getCachedByImdbId?.(seriesImdbId) ?? ratingsCache.getCached?.('imdb', seriesImdbId);
        if (c2) return c2;
      } catch (e) {
        // ignore
      }
    }

    return null;
  }, [ratingsCache, seriesTmdbId, seriesImdbId, useOmdbRatings]);

  // helper to render the compact/expanded star rating UI
  const renderStarControl = () => {
    // Collapsed view: show a compact badge with a star + rating number (prefer userRating, else TMDB)
    if (!onRate) return null;

    if (!starsExpanded) {
      const compactValue =
        typeof userRating === 'number'
          ? userRating.toFixed(1)
          : tmdbRating ?? 'N/A';

      return (
        <button
          type="button"
          onClick={() => setStarsExpanded(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-100"
          aria-label="Expand rating stars"
        >
          <Star size={16} className="fill-amber-400 text-amber-400" />
          <span className="font-semibold">{compactValue}</span>
        </button>
      );
    }

    // Expanded: full 10-star selector (same behaviour as your DetailView)
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const active = typeof userRating === 'number' && userRating >= n;
          return (
            <button
              key={n}
              onClick={() => {
                onRate(String(episode.id), n);
                // keep expanded — user might change again; optionally collapse after set:
                // setStarsExpanded(false);
              }}
              className={`p-1 transition-transform hover:scale-110 ${active ? 'text-cyan-400' : 'text-slate-600'}`}
              aria-label={`Rate ${n} stars`}
            >
              <Star
                size={16}
                className={active ? 'fill-cyan-400' : 'fill-slate-800'}
              />
            </button>
          );
        })}
        <button
          onClick={() => setStarsExpanded(false)}
          className="ml-2 px-2 py-1 text-xs rounded-md bg-white/5 border border-white/10"
        >
          Done
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-2">
      <div className="relative max-w-3xl w-full max-h-[90vh] overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/40 hover:bg-black/70 text-slate-200"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="grid md:grid-cols-[1.1fr_1.2fr] gap-0 h-full">
          {/* Left: still */}
          <div className="relative bg-slate-900">
            <img
              src={
                episode.still_path
                  ? `https://image.tmdb.org/t/p/w780${episode.still_path}`
                  : 'https://picsum.photos/800/450'
              }
              alt={episode.name || 'Episode still'}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

            <div className="absolute bottom-4 left-4 right-4 space-y-2">
              {showTitle && (
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-black/50 text-xs text-slate-200">
                  <Tv size={14} />
                  <span className="font-semibold">{showTitle}</span>
                </div>
              )}
              <h2 className="text-xl md:text-2xl font-bold text-white">
                S{episode.season_number} · E{episode.episode_number} —{' '}
                {episode.name}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <Calendar size={14} />
                  {episode.air_date || 'Unknown'}
                </span>

                {tmdbRating && (
                  <span className="inline-flex items-center gap-1">
                    <Star size={14} className="text-amber-400 fill-amber-400" />
                    TMDB {tmdbRating}
                  </span>
                )}

                {typeof userRating === 'number' && (
                  <span className="inline-flex items-center gap-1 text-cyan-300">
                    <Star size={14} className="fill-cyan-400 text-cyan-400" />
                    Your {userRating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: details */}
          <div className="p-4 md:p-6 flex flex-col gap-4 overflow-y-auto">
            {/* Overview */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">
                Overview
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {episode.overview || 'No synopsis available for this episode.'}
              </p>
            </div>

            {/* Ratings row from cached series (OMDb/Metacritic/RT) */}
            {useOmdbRatings && cachedSeriesRating && (
              <div className="flex items-center gap-3">
                {/* IMDb */}
                {cachedSeriesRating.imdbRating && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                    <Star size={14} className="fill-amber-400" />
                    <span className="font-semibold">
                      {parseFloat(cachedSeriesRating.imdbRating).toFixed(1)}
                    </span>
                    <span className="text-xs text-amber-200/70 ml-1">IMDb</span>
                  </div>
                )}

                {/* Metacritic */}
                {cachedSeriesRating.metascore && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-sm">
                    <span className="font-semibold">
                      {cachedSeriesRating.metascore}
                    </span>
                    <span className="text-xs text-green-200/70 ml-1">
                      Metacritic
                    </span>
                  </div>
                )}

                {/* Rotten Tomatoes */}
                {cachedSeriesRating.rottenTomatoes && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                    <span className="font-semibold">
                      {cachedSeriesRating.rottenTomatoes}
                    </span>
                    <span className="text-xs text-red-200/70 ml-1">
                      Rotten Tomatoes
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Open in Stremio (episode-aware) */}
            <div className="mt-2">
              <a
                href={stremioEpisodeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1b2332]/90 hover:bg-[#252f3f] border border-cyan-500/40 hover:border-cyan-400/70 text-xs font-semibold text-slate-100 transition-all"
              >
                <img
                  src="/stremio-icon.png"
                  alt="Open in Stremio"
                  className="w-5 h-5 rounded-md"
                />
                <span>Open this episode in Stremio</span>
              </a>
            </div>

            {/* Collapsible user rating control */}
            {onRate && (
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-1">
                  Your Rating
                </h3>
                {renderStarControl()}
              </div>
            )}

            {/* TMDB Reviews */}
            {reviews.length > 0 && (
              <div className="mt-2 space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">
                  TMDB Reviews
                </h3>
                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-100">
                          {rev.author || rev.author_details.username || 'User'}
                        </span>
                        {typeof rev.author_details?.rating === 'number' && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                            <Star size={12} className="fill-amber-400" />
                            {rev.author_details.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-4">
                        {rev.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reviews.length === 0 && (
              <p className="text-xs text-slate-500">
                No TMDB reviews available for this episode yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EpisodeDetailView;