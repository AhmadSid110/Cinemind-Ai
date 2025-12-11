// src/components/EpisodeDetailView.tsx
import React, { useEffect, useState } from 'react';
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
  ratingsCache?: any; // your useRatingsCache return value
  useOmdbRatings?: boolean;
}

/**
 * EpisodeDetailView
 * - Shows episode info
 * - Displays OMDb / Metacritic / RT ratings when available
 * - Collapsible user rating: collapsed shows a single badge (e.g. "9⭐"), expanded shows 10-star control
 *
 * Notes:
 * - This view tries to show an episode-specific OMDb rating first (if possible).
 * - If an episode-level rating is not available, it falls back to the series-level rating and
 *   displays a small "series" hint so the user isn't misled.
 */

const EpisodeDetailView: React.FC<EpisodeDetailViewProps> = ({
  episode,
  showTitle,
  onClose,
  onRate,
  userRating,
  ratingsCache,
  useOmdbRatings = true,
}) => {
  const [episodeRating, setEpisodeRating] = useState<{
    imdbRating?: string | null;
    metascore?: string | null;
    rottenTomatoes?: string | null;
    source?: 'episode' | 'series' | null;
  } | null>(null);

  const [ratingCollapsed, setRatingCollapsed] = useState(true);
  const [loadingRating, setLoadingRating] = useState(false);

  // episode date/year for stremio context
  const airYear = episode.air_date ? new Date(episode.air_date).getFullYear() : undefined;

  const reviews: Review[] = episode.reviews?.results || [];

  const tmdbRating =
    typeof episode.vote_average === 'number' ? episode.vote_average.toFixed(1) : 'N/A';

  // Series-level IDs (should be injected by App when fetching episode details)
  const seriesImdbId: string | undefined = (episode as any).show_imdb_id ?? (episode as any).showImdbId ?? undefined;
  const seriesTvdbId: number | undefined =
    typeof (episode as any).show_tvdb_id === 'number' ? (episode as any).show_tvdb_id : undefined;

  const stremioEpisodeCtx: StremioEpisodeContext = {
    title: showTitle || episode.name || '',
    year: airYear,
    type: 'series',
    imdbId: seriesImdbId,
    tvdbId: seriesTvdbId,
    season: episode.season_number,
    episode: episode.episode_number,
  };

  const stremioEpisodeUrl = buildStremioEpisodeUrl(stremioEpisodeCtx);

  // Try to load rating info:
  // Priority:
  //  1) episode-level rating (if cache or ratingsCache has method for episode)
  //  2) series-level rating from ratingsCache (if present)
  //  3) none available -> show nothing
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!useOmdbRatings || !ratingsCache) return;

      setLoadingRating(true);
      try {
        // Try episode-specific entry first — we expect ratingsCache to expose a method `getCachedEpisode`
        // or `getCached` by a special key. We'll first try a specialized method, then fallback to series.
        let ep = null;

        // Preferred: ratingsCache.getCachedEpisode(showTmdbId, season, episode)
        if (typeof ratingsCache.getCachedEpisode === 'function') {
          // If your cache supports episode-level keys, it'll return a rating entry or null
          ep = ratingsCache.getCachedEpisode((episode as any).show_id || (episode as any).show_tmdb_id || (episode as any).series_id, episode.season_number, episode.episode_number);
          if (!ep && typeof ratingsCache.refreshEpisode === 'function') {
            // optionally trigger a background refresh and then read
            await ratingsCache.refreshEpisode((episode as any).show_id || (episode as any).show_tmdb_id || (episode as any).series_id, episode.season_number, episode.episode_number);
            ep = ratingsCache.getCachedEpisode((episode as any).show_id || (episode as any).show_tmdb_id || (episode as any).series_id, episode.season_number, episode.episode_number);
          }
        }

        // If we didn't get episode entry, fallback to series (show)
        if (!ep) {
          // ratingsCache.getCached expects (mediaType, tmdbId)
          const showTmdb = (episode as any).show_id || (episode as any).show_tmdb_id || (episode as any).series_id;
          if (showTmdb && typeof ratingsCache.getCached === 'function') {
            const seriesEntry = ratingsCache.getCached('tv', showTmdb);
            if (seriesEntry) {
              ep = {
                imdbRating: seriesEntry.imdbRating ?? null,
                metascore: seriesEntry.metascore ?? null,
                rottenTomatoes: seriesEntry.rottenTomatoes ?? null,
                _source: 'series',
              };
            }
          }
        }

        if (!mounted) return;

        if (ep) {
          setEpisodeRating({
            imdbRating: ep.imdbRating ?? null,
            metascore: ep.metascore ?? null,
            rottenTomatoes: ep.rottenTomatoes ?? null,
            source: (ep._source === 'episode' ? 'episode' : ep._source === 'series' ? 'series' : null) ?? (ep.imdbRating ? 'series' : null),
          });
        } else {
          setEpisodeRating(null);
        }
      } catch (err) {
        // silently ignore
        console.error('episode rating load failed', err);
        if (mounted) setEpisodeRating(null);
      } finally {
        if (mounted) setLoadingRating(false);
      }
    };

    load();

    return () => { mounted = false; };
  }, [episode, ratingsCache, useOmdbRatings]);

  // Helper to render rating badges (compact)
  const renderRatingBadges = () => {
    if (!episodeRating) return null;

    const items: JSX.Element[] = [];

    if (episodeRating.imdbRating) {
      items.push(
        <div key="imdb" className="flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30">
          <Star size={14} className="text-amber-400 fill-amber-400" />
          <span className="font-semibold text-amber-200">{parseFloat(episodeRating.imdbRating).toFixed(1)}</span>
          <span className="text-xs text-amber-100/70">IMDb{episodeRating.source === 'series' ? ' (series)' : ''}</span>
        </div>
      );
    }

    if (episodeRating.metascore) {
      items.push(
        <div key="meta" className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
          <span className="font-semibold text-emerald-200">{episodeRating.metascore}</span>
          <span className="text-xs text-emerald-100/70">Metacritic</span>
        </div>
      );
    }

    if (episodeRating.rottenTomatoes) {
      items.push(
        <div key="rt" className="flex items-center gap-2 px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/25">
          <span className="font-semibold text-red-200">{episodeRating.rottenTomatoes}</span>
          <span className="text-xs text-red-100/70">Rotten Tomatoes</span>
        </div>
      );
    }

    return <div className="flex items-center gap-3">{items}</div>;
  };

  // Render
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-2">
      <div className="relative max-w-3xl w-full max-h-[90vh] overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/40 hover:bg-black/70 text-slate-200"
        >
          <X size={18} />
        </button>

        <div className="grid md:grid-cols-[1.1fr_1.2fr] gap-0 h-full">
          {/* Left: still */}
          <div className="relative bg-slate-900">
            <img
              src={
                episode.still_path ? `https://image.tmdb.org/t/p/w780${episode.still_path}` : 'https://picsum.photos/800/450'
              }
              alt={episode.name}
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
                S{episode.season_number} · E{episode.episode_number} — {episode.name}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <Calendar size={14} />
                  {episode.air_date || 'Unknown'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  TMDB {tmdbRating}
                </span>
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
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Overview</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {episode.overview || 'No synopsis available for this episode.'}
              </p>
            </div>

            {/* Ratings */}
            <div className="mt-2">
              {loadingRating ? (
                <div className="text-xs text-slate-400">Checking ratings...</div>
              ) : (
                renderRatingBadges()
              )}
            </div>

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

            {/* Collapsible user rating */}
            <div className="mt-2">
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Your Rating</h3>

              {/* Collapsed view: show single badge with rating or empty star */}
              {ratingCollapsed ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setRatingCollapsed(false)}
                    className="px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-slate-100 flex items-center gap-2"
                  >
                    <Star size={16} className="fill-amber-400" />
                    <span>{typeof userRating === 'number' && userRating > 0 ? userRating.toFixed(1) : 'Rate'}</span>
                  </button>
                  <button
                    onClick={() => setRatingCollapsed(false)}
                    className="text-xs text-slate-400 underline"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                // Expanded: show 10 star buttons
                <div className="flex items-center gap-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                    const filled = typeof userRating === 'number' && userRating >= n;
                    return (
                      <button
                        key={n}
                        onClick={() => onRate && onRate(String(episode.id), n)}
                        className={`p-1 ${filled ? 'text-cyan-400' : 'text-slate-600'}`}
                        title={`${n}`}
                      >
                        <Star size={18} className={filled ? 'fill-cyan-400' : 'fill-slate-800'} />
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setRatingCollapsed(true)}
                    className="ml-2 text-xs text-slate-400 underline"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

            {/* TMDB Reviews */}
            {reviews.length > 0 ? (
              <div className="mt-2 space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">TMDB Reviews</h3>
                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-100">
                          {rev.author || rev.author_details.username || 'User'}
                        </span>
                        {typeof rev.author_details?.rating === 'number' && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                            {rev.author_details.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-4">{rev.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No TMDB reviews available for this episode yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EpisodeDetailView;