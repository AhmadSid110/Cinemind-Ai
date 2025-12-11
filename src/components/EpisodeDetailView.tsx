// src/components/EpisodeDetailView.tsx
import React, { useEffect, useMemo, useState } from 'react';
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
  ratingsCache?: any; // useRatingsCache instance
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
  const airYear = episode.air_date ? new Date(episode.air_date).getFullYear() : undefined;
  const reviews: Review[] = episode.reviews?.results || [];
  const tmdbRating = typeof episode.vote_average === 'number' ? episode.vote_average.toFixed(1) : 'N/A';

  // Series-level IDs (should be injected by App.tsx when fetching episode)
  const seriesImdbId: string | undefined = (episode as any).show_imdb_id ?? undefined;
  const seriesTvdbId: number | undefined =
    typeof (episode as any).show_tvdb_id === 'number' ? (episode as any).show_tvdb_id : undefined;
  // Prefer tmdb show id for episode cache key if available
  const tmdbShowId: number | undefined = (episode as any).show_id ?? (episode as any).tv_id ?? undefined;

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

  // Episode-level OMDb rating (from ratingsCache)
  const [episodeRatingLoading, setEpisodeRatingLoading] = useState(false);
  const episodeCacheKeyId = useMemo(() => {
    // build cache id used by cache (prefer tmdbShowId else fallback to seriesImdbId)
    return tmdbShowId ?? seriesImdbId ?? episode.id;
  }, [tmdbShowId, seriesImdbId, episode.id]);

  // cachedRating could be episode-specific or fallback to series-level
  const cachedEpisodeRating = useMemo(() => {
    if (!ratingsCache) return null;
    // 1) check episode-level by tmdbShowId/imdb + season/episode
    if (tmdbShowId) {
      return ratingsCache.getCachedEpisode(tmdbShowId, episode.season_number, episode.episode_number) ??
        ratingsCache.getCached('tv', tmdbShowId);
    }
    if (seriesImdbId) {
      // fallback: cache keyed by imdb string - we used same function in cache (episodeKey supports string)
      return ratingsCache.getCachedEpisode(seriesImdbId, episode.season_number, episode.episode_number) ??
        null;
    }
    return null;
  }, [ratingsCache, tmdbShowId, seriesImdbId, episode.season_number, episode.episode_number]);

  // On mount, request episode-level rating in background (only if OMDb enabled)
  useEffect(() => {
    if (!ratingsCache) return;
    if (!useOmdbRatings) return;
    if (!seriesImdbId && !tmdbShowId) return; // cannot fetch if no show ID
    // if cached and fresh, no need
    const existing = ratingsCache.getCachedEpisode(tmdbShowId ?? seriesImdbId, episode.season_number, episode.episode_number);
    const shouldRefresh = !existing || (Date.now() - (existing.fetchedAt || 0)) > (1000 * 60 * 60 * 24);
    if (!shouldRefresh) return;

    // fire background refresh
    setEpisodeRatingLoading(true);
    const promise = ratingsCache.refreshEpisode(seriesImdbId ?? null, tmdbShowId ?? (seriesImdbId ?? String(episode.id)), episode.season_number, episode.episode_number, true);
    promise.finally(() => setEpisodeRatingLoading(false));
    // no need to await here
  }, [ratingsCache, useOmdbRatings, seriesImdbId, tmdbShowId, episode.season_number, episode.episode_number, episode.id]);

  // Collapsible star UI state
  const [starsCollapsed, setStarsCollapsed] = useState(false);

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
                S{episode.season_number} · E{episode.episode_number} &mdash; {episode.name}
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

            {/* Ratings row (OMDb episode-level preferred; fallback to series-level cached) */}
            {useOmdbRatings && ratingsCache && (
              <div className="mt-2 flex items-center gap-3">
                {/* episode-level cached */}
                {cachedEpisodeRating?.imdbRating ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 backdrop-blur-md text-amber-300">
                    <Star size={14} className="text-amber-400 fill-amber-400" />
                    <span className="font-semibold">{parseFloat(cachedEpisodeRating.imdbRating).toFixed(1)}</span>
                    <span className="text-xs text-amber-200/70">IMDb</span>
                  </div>
                ) : (cachedEpisodeRating?.imdbId && !episodeRatingLoading) ? (
                  // we have an imdb id but no rating (or OMDb returned no rating)
                  <div className="text-xs text-slate-400 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700">
                    N/A IMDb
                  </div>
                ) : episodeRatingLoading ? (
                  <div className="text-xs text-slate-400 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700">
                    Loading episode ratings...
                  </div>
                ) : null}

                {/* also show metacritic/rt if available */}
                {cachedEpisodeRating?.metascore && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300">
                    <span className="font-semibold">{cachedEpisodeRating.metascore}</span>
                    <span className="text-xs text-green-200/70">Metacritic</span>
                  </div>
                )}
                {cachedEpisodeRating?.rottenTomatoes && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
                    <span className="font-semibold">{cachedEpisodeRating.rottenTomatoes}</span>
                    <span className="text-xs text-red-200/70">Rotten Tomatoes</span>
                  </div>
                )}
              </div>
            )}

            {/* Open in Stremio */}
            <div className="mt-2">
              <a
                href={stremioEpisodeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1b2332]/90 hover:bg-[#252f3f] border border-cyan-500/40 hover:border-cyan-400/70 text-xs font-semibold text-slate-100 transition-all"
              >
                <img src="/stremio-icon.png" alt="Open in Stremio" className="w-5 h-5 rounded-md" />
                <span>Open this episode in Stremio</span>
              </a>
            </div>

            {/* User rating control with collapsible UI */}
            {onRate && (
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-1">Your Rating</h3>

                <div className="flex items-center gap-3">
                  {starsCollapsed ? (
                    // collapsed: show small badge with user's rating (or empty star to invite)
                    <button
                      onClick={() => setStarsCollapsed(false)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 hover:bg-white/5"
                    >
                      {typeof userRating === 'number' ? (
                        <>
                          <Star size={16} className="fill-cyan-400 text-cyan-400" />
                          <span className="font-semibold">{userRating.toFixed(1)}</span>
                        </>
                      ) : (
                        <>
                          <Star size={16} className="text-slate-400" />
                          <span className="text-slate-400">Rate</span>
                        </>
                      )}
                    </button>
                  ) : (
                    // expanded: full 10-star control
                    <div className="inline-flex items-center gap-2 bg-slate-900/60 border border-white/10 rounded-lg p-2">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          onClick={() => onRate && onRate(String(episode.id), n)}
                          className={`p-1 ${userRating && userRating >= n ? 'text-cyan-400' : 'text-slate-600'}`}
                        >
                          <Star
                            size={18}
                            className={userRating && userRating >= n ? 'fill-cyan-400' : 'fill-slate-800'}
                          />
                        </button>
                      ))}
                      <button
                        onClick={() => setStarsCollapsed(true)}
                        className="ml-2 text-xs px-3 py-1 rounded-md bg-white/5 border border-white/10"
                      >
                        Collapse
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TMDB Reviews */}
            {reviews.length > 0 && (
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
            )}

            {reviews.length === 0 && <p className="text-xs text-slate-500">No TMDB reviews available for this episode yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EpisodeDetailView;