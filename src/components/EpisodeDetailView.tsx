// src/components/EpisodeDetailView.tsx
import React, { useEffect, useRef, useState } from 'react';
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
  ratingsCache?: any; // improved: support getEpisodeCached + refreshEpisode
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

  // TMDB rating for the episode (still show for "TMDB" badge)
  const tmdbRating = typeof episode.vote_average === 'number' ? episode.vote_average.toFixed(1) : 'N/A';

  // Series-level IDs should be injected into the episode object by App.tsx:
  // episode.show_imdb_id, episode.show_tvdb_id, episode.show_id
  const seriesImdbId: string | undefined = (episode as any).show_imdb_id || undefined;
  const seriesTvdbId: number | undefined = typeof (episode as any).show_tvdb_id === 'number' ? (episode as any).show_tvdb_id : undefined;

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

  // ---- OMDb episode rating state ----
  const [episodeOmdb, setEpisodeOmdb] = useState<{
    imdbRating?: string | null;
    imdbVotes?: string | null;
    metascore?: string | null;
    rottenTomatoes?: string | null;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadEpisodeRating() {
      if (!useOmdbRatings || !ratingsCache || !seriesImdbId) {
        setEpisodeOmdb(null);
        return;
      }

      // Check cache first
      const cached = ratingsCache.getEpisodeCached?.(seriesImdbId, episode.season_number, episode.episode_number);
      if (cached && cached.imdbRating) {
        if (mounted) {
          setEpisodeOmdb({
            imdbRating: cached.imdbRating,
            imdbVotes: cached.imdbVotes,
            metascore: cached.metascore,
            rottenTomatoes: cached.rottenTomatoes,
          });
        }
        // If stale, also trigger background refresh
        const now = Date.now();
        if (!cached.fetchedAt || now - cached.fetchedAt > (1000 * 60 * 60 * 24)) {
          ratingsCache.refreshEpisode?.(seriesImdbId, episode.season_number, episode.episode_number, true).then((refreshed) => {
            if (!mounted || !refreshed) return;
            setEpisodeOmdb({
              imdbRating: refreshed.imdbRating,
              imdbVotes: refreshed.imdbVotes,
              metascore: refreshed.metascore,
              rottenTomatoes: refreshed.rottenTomatoes,
            });
          });
        }
        return;
      }

      // No cache — trigger refresh
      try {
        const refreshed = await ratingsCache.refreshEpisode?.(seriesImdbId, episode.season_number, episode.episode_number, false);
        if (mounted && refreshed) {
          setEpisodeOmdb({
            imdbRating: refreshed.imdbRating,
            imdbVotes: refreshed.imdbVotes,
            metascore: refreshed.metascore,
            rottenTomatoes: refreshed.rottenTomatoes,
          });
        }
      } catch (e) {
        // ignore
        console.error('Episode OMDb fetch failed', e);
      }
    }

    loadEpisodeRating();
    return () => {
      mounted = false;
    };
  }, [seriesImdbId, episode.season_number, episode.episode_number, ratingsCache, useOmdbRatings]);

  // ----- collapsible "Your Rating" UI -----
  const [ratingCollapsed, setRatingCollapsed] = useState<boolean>(true); // default collapsed
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (ev: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current) return;
      const target = ev.target as Node | null;
      if (!target) return;
      if (!wrapperRef.current.contains(target)) {
        setRatingCollapsed(true);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, []);

  // When the modal opens, keep collapsed by default
  useEffect(() => {
    setRatingCollapsed(true);
  }, [episode.id]);

  // star click handler
  const handleStarClick = (n: number) => {
    if (!onRate) return;
    onRate(String(episode.id), n);
  };

  // Small helper to render the collapsed badge: shows user's rating if present else shows a star icon + "Rate"
  const CollapsedBadge: React.FC = () => {
    if (typeof userRating === 'number' && userRating > 0) {
      return (
        <button
          onClick={() => setRatingCollapsed(false)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-slate-100 font-semibold"
        >
          <Star size={16} className="fill-cyan-400 text-cyan-400" />
          <span>{userRating.toFixed(1)}</span>
        </button>
      );
    }

    return (
      <button
        onClick={() => setRatingCollapsed(false)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 border border-white/6 text-slate-200 font-medium"
      >
        <Star size={16} />
        <span>Rate</span>
      </button>
    );
  };

  // render OMDb badges (IMDb / Metacritic / Rotten)
  const OmdbBadges: React.FC = () => {
    if (!useOmdbRatings) return null;
    if (!episodeOmdb || (!episodeOmdb.imdbRating && !episodeOmdb.metascore && !episodeOmdb.rottenTomatoes)) {
      return null;
    }

    return (
      <div className="flex items-center gap-3 mb-4">
        {episodeOmdb?.imdbRating && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            <span className="font-bold text-lg text-amber-300">{parseFloat(episodeOmdb.imdbRating).toFixed(1)}</span>
            <span className="text-xs text-amber-200/70 font-medium">IMDb</span>
          </div>
        )}
        {episodeOmdb?.metascore && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/20 border border-green-500/30">
            <span className="font-bold text-lg text-green-300">{episodeOmdb.metascore}</span>
            <span className="text-xs text-green-200/70 font-medium">Metacritic</span>
          </div>
        )}
        {episodeOmdb?.rottenTomatoes && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/30">
            <span className="font-bold text-lg text-red-300">{episodeOmdb.rottenTomatoes}</span>
            <span className="text-xs text-red-200/70 font-medium">Rotten Tomatoes</span>
          </div>
        )}

        {/* show TMDB episode rating as small pill too */}
        {tmdbRating !== 'N/A' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
            <Star size={14} className="fill-cyan-400 text-cyan-400" />
            <span className="font-bold text-sm text-cyan-300">{tmdbRating}</span>
            <span className="text-xs text-cyan-200/70 font-medium">TMDB</span>
          </div>
        )}
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
        >
          <X size={18} />
        </button>

        <div className="grid md:grid-cols-[1.1fr_1.2fr] gap-0 h-full">
          {/* Left: still */}
          <div className="relative bg-slate-900">
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
          <div className="p-4 md:p-6 flex flex-col gap-4 overflow-y-auto" ref={wrapperRef}>
            {/* Overview */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Overview</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {episode.overview || 'No synopsis available for this episode.'}
              </p>
            </div>

            {/* OMDb / TMDB badges */}
            <OmdbBadges />

            {/* Open in Stremio (episode-aware) */}
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

            {/* Collapsible user rating control */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Your Rating</h3>
              <div>
                {ratingCollapsed ? (
                  <CollapsedBadge />
                ) : (
                  <div className="inline-flex items-center gap-2 bg-slate-900/60 border border-white/6 rounded-lg px-3 py-2">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                      const active = typeof userRating === 'number' && userRating >= n;
                      return (
                        <button
                          key={n}
                          onClick={() => handleStarClick(n)}
                          className={`p-1 ${active ? 'text-cyan-400' : 'text-slate-600'}`}
                          aria-label={`Rate ${n}`}
                        >
                          <Star size={16} className={active ? 'fill-cyan-400' : 'fill-slate-800'} />
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setRatingCollapsed(true)}
                      className="ml-3 px-3 py-1 rounded-lg bg-white/6 border border-white/8 text-xs"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
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