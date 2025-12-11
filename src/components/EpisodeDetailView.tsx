// src/components/EpisodeDetailView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { X, Star, Calendar, Tv, Check, Heart as LucideHeart } from 'lucide-react';
import { EpisodeDetail, Review } from '../types';
import StarRating from './StarRating';
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
  ratingsCache?: {
    // simple shape used by this component: getCached(mediaType, id) -> { imdbRating?, metascore?, rottenTomatoes? }
    getCached: (mediaType: string, id: number) => any | null;
  };
  useOmdbRatings?: boolean;
  // optional handlers to wire favorite/watchlist if you'd like
  onToggleFavorite?: (mediaId: number) => void;
  onToggleWatchlist?: (mediaId: number) => void;
  isFavorite?: boolean;
  isWatchlist?: boolean;
}

const HeartIcon: React.FC<{ filled?: boolean; size?: number }> = ({ filled = false, size = 18 }) => (
  <LucideHeart size={size} className={filled ? 'fill-current text-pink-400' : 'text-slate-300'} />
);

const EpisodeDetailView: React.FC<EpisodeDetailViewProps> = ({
  episode,
  showTitle,
  onClose,
  onRate,
  userRating,
  ratingsCache,
  useOmdbRatings = true,
  onToggleFavorite,
  onToggleWatchlist,
  isFavorite = false,
  isWatchlist = false,
}) => {
  const airYear = episode.air_date ? new Date(episode.air_date).getFullYear() : undefined;
  const reviews: Review[] = episode.reviews?.results || [];
  const tmdbRating = typeof episode.vote_average === 'number' ? episode.vote_average.toFixed(1) : 'N/A';

  // series-level IDs (App.tsx can inject these onto episode object if available)
  const seriesImdbId: string | undefined = (episode as any).show_imdb_id || undefined;
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

  // cached ratings (optional)
  const cachedRating = useOmdbRatings && ratingsCache ? ratingsCache.getCached('tv', (episode as any).show_id || (episode as any).show ?? (episode as any).show_id || (episode as any).id) : null;
  // Note: the logic above tries to find `show_id` (if you added it when fetching). If your App injects the series' TMDB id as show_id or adds series imdb id to episode, ensure that matches how ratingsCache expects keys.

  // local UI state
  const [addOpen, setAddOpen] = useState(false);
  const [ratingCollapsed, setRatingCollapsed] = useState(true);
  const addRef = useRef<HTMLDivElement | null>(null);

  // Close "Add to" popup on outside click / Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setAddOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // helper to show compact rating badge for user rating when collapsed
  const collapsedUserBadge = userRating && !isNaN(userRating) ? `${Number(userRating).toFixed(0)}⭐` : null;

  // helper for clicking favorite/watchlist - use provided handlers if present
  const handleToggleFavorite = () => {
    if (onToggleFavorite) onToggleFavorite((episode as any).show_id || (episode as any).show || (episode as any).id);
    // close popup for a nicer UX
    setAddOpen(false);
  };
  const handleToggleWatchlist = () => {
    if (onToggleWatchlist) onToggleWatchlist((episode as any).show_id || (episode as any).show || (episode as any).id);
    setAddOpen(false);
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
          <div className="relative bg-slate-900 min-h-[220px]">
            <img
              src={episode.still_path ? `https://image.tmdb.org/t/p/w780${episode.still_path}` : 'https://picsum.photos/800/450'}
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
              <h2 className="text-lg md:text-xl font-bold text-white">
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
                {ratingCollapsed ? (
                  // collapsed: show small badge for user rating
                  collapsedUserBadge ? (
                    <span className="inline-flex items-center gap-1 text-cyan-300 bg-slate-800/60 px-2 py-0.5 rounded-md text-xs font-semibold">
                      <Star size={12} className="fill-cyan-400 text-cyan-400" />
                      {collapsedUserBadge}
                    </span>
                  ) : null
                ) : (
                  // expanded inline small star rating (we show full control in the right pane)
                  null
                )}
              </div>
            </div>
          </div>

          {/* Right: details */}
          <div className="p-4 md:p-6 flex flex-col gap-4 overflow-y-auto">
            {/* Overview */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Overview</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{episode.overview || 'No synopsis available for this episode.'}</p>
            </div>

            {/* Compact rating badges (IMDb / Metacritic / Rotten / TMDB) */}
            <div className="flex items-center gap-2 flex-wrap">
              {useOmdbRatings && cachedRating?.imdbRating && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-semibold">
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  {parseFloat(cachedRating.imdbRating).toFixed(1)}
                  <span className="text-xs text-amber-200/70 ml-1">IMDb</span>
                </div>
              )}

              {useOmdbRatings && cachedRating?.metascore && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-green-500/10 border border-green-500/20 text-green-300 text-sm font-semibold">
                  {cachedRating.metascore}
                  <span className="text-xs text-green-200/70 ml-1">Metacritic</span>
                </div>
              )}

              {useOmdbRatings && cachedRating?.rottenTomatoes && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm font-semibold">
                  {cachedRating.rottenTomatoes}
                  <span className="text-xs text-red-200/70 ml-1">RT</span>
                </div>
              )}

              {episode.vote_average && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm font-semibold">
                  <Star size={14} className="text-cyan-400 fill-cyan-400" />
                  {episode.vote_average.toFixed(1)}
                  <span className="text-xs text-cyan-200/70 ml-1">TMDB</span>
                </div>
              )}
            </div>

            {/* Actions row: Add to (popup), Open in Stremio */}
            <div className="flex items-center gap-3">
              {/* Add to button with popup */}
              <div className="relative" ref={addRef}>
                <button
                  onClick={() => setAddOpen((s) => !s)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-sm font-semibold border border-white/10 hover:bg-white/10"
                >
                  <span className="flex items-center gap-2">
                    <HeartIcon filled={isFavorite} />
                    Add to
                  </span>
                </button>

                {addOpen && (
                  <div className="absolute mt-2 right-0 w-48 bg-slate-900 border border-slate-800 rounded-lg shadow-lg z-50 p-2">
                    <button
                      onClick={handleToggleFavorite}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <HeartIcon filled={isFavorite} />
                        <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>
                      </div>
                      {isFavorite && <Check size={16} className="text-emerald-400" />}
                    </button>

                    <button
                      onClick={handleToggleWatchlist}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded hover:bg-slate-800 mt-1"
                    >
                      <div className="flex items-center gap-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-slate-300"><path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="1.5"/></svg>
                        <span>{isWatchlist ? 'On Watchlist' : 'Watchlist'}</span>
                      </div>
                      {isWatchlist && <Check size={16} className="text-emerald-400" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Open in Stremio */}
              <a
                href={stremioEpisodeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-700/90 hover:bg-indigo-600 text-sm font-semibold"
              >
                <img src="/stremio-icon.png" alt="Open in Stremio" className="w-4 h-4 rounded-sm" />
                Open in Stremio
              </a>

              {/* Toggle rating collapse */}
              <button
                onClick={() => setRatingCollapsed((s) => !s)}
                className="ml-auto px-2 py-1 rounded-md bg-slate-800/60 text-xs text-slate-300 hover:bg-slate-800"
                aria-pressed={!ratingCollapsed}
                aria-label={ratingCollapsed ? 'Expand rating control' : 'Collapse rating control'}
              >
                {ratingCollapsed ? 'Expand rating' : 'Collapse rating'}
              </button>
            </div>

            {/* Rating control (collapsible) */}
            <div>
              {!ratingCollapsed ? (
                <div className="mt-1">
                  <h4 className="text-xs text-slate-400 mb-1">Your Rating</h4>
                  {onRate ? (
                    <StarRating
                      value={userRating || 0}
                      onChange={(rating) => onRate(String(episode.id), rating)}
                      size={20}
                    />
                  ) : (
                    <div className="text-sm text-slate-400">Sign in to rate</div>
                  )}
                </div>
              ) : (
                // when collapsed we show the compact badge (handled in left area too) but repeat here for clarity
                <div className="mt-1 text-xs text-slate-500">
                  {collapsedUserBadge ? (
                    <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-slate-800/50">
                      <Star size={12} className="fill-cyan-400 text-cyan-400" />
                      <span className="font-semibold">{collapsedUserBadge}</span>
                    </span>
                  ) : (
                    <span className="text-slate-500">No rating yet</span>
                  )}
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
                        <span className="text-xs font-semibold text-slate-100">{rev.author || rev.author_details.username || 'User'}</span>
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