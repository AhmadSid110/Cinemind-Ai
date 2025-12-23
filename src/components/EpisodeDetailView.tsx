// src/components/EpisodeDetailView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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
  ratingsCache?: any; // supports getEpisodeCached(seriesImdb, season, episode) + refreshEpisode(...)
  useOmdbRatings?: boolean;
  showEpisodeImdbOnSeasonList?: boolean;
}

const EpisodeDetailView: React.FC<EpisodeDetailViewProps> = ({
  episode,
  showTitle,
  onClose,
  onRate,
  userRating,
  ratingsCache,
  useOmdbRatings = true,
  showEpisodeImdbOnSeasonList = false,
}) => {
  const airYear = episode.air_date ? new Date(episode.air_date).getFullYear() : undefined;
  const reviews: Review[] = episode.reviews?.results || [];

  // TMDB rating (episode-level)
  const tmdbRating = typeof episode.vote_average === 'number' ? episode.vote_average.toFixed(1) : 'N/A';

  // Series-level ids (injected by App.tsx)
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
    fetchedAt?: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadEpisodeRating() {
      if (!useOmdbRatings || !ratingsCache || !seriesImdbId) {
        setEpisodeOmdb(null);
        return;
      }

      // Check cache first (episode-level)
      try {
        const cached = typeof ratingsCache.getEpisodeCached === 'function'
          ? ratingsCache.getEpisodeCached(seriesImdbId, episode.season_number, episode.episode_number)
          : null;

        if (cached && (cached.imdbRating || cached.metascore || cached.rottenTomatoes)) {
          if (mounted) {
            setEpisodeOmdb({
              imdbRating: cached.imdbRating ?? null,
              imdbVotes: cached.imdbVotes ?? null,
              metascore: cached.metascore ?? null,
              rottenTomatoes: cached.rottenTomatoes ?? null,
              fetchedAt: cached.fetchedAt ?? Date.now(),
            });
          }

          // If stale -> trigger background refresh
          const now = Date.now();
          const staleMs = 1000 * 60 * 60 * 24; // 24h
          if (!cached.fetchedAt || (now - cached.fetchedAt) > staleMs) {
            ratingsCache.refreshEpisode?.(seriesImdbId, episode.season_number, episode.episode_number, true)
              .then((refreshed: any) => {
                if (!mounted || !refreshed) return;
                setEpisodeOmdb({
                  imdbRating: refreshed.imdbRating ?? null,
                  imdbVotes: refreshed.imdbVotes ?? null,
                  metascore: refreshed.metascore ?? null,
                  rottenTomatoes: refreshed.rottenTomatoes ?? null,
                  fetchedAt: refreshed.fetchedAt ?? Date.now(),
                });
              })
              .catch(() => {});
          }
          return;
        }

        // Not cached -> fetch via refreshEpisode
        const refreshed = await ratingsCache.refreshEpisode?.(seriesImdbId, episode.season_number, episode.episode_number, false);
        if (mounted && refreshed) {
          setEpisodeOmdb({
            imdbRating: refreshed.imdbRating ?? null,
            imdbVotes: refreshed.imdbVotes ?? null,
            metascore: refreshed.metascore ?? null,
            rottenTomatoes: refreshed.rottenTomatoes ?? null,
            fetchedAt: refreshed.fetchedAt ?? Date.now(),
          });
        }
      } catch (err) {
        console.error('Episode OMDb fetch failed', err);
      }
    }

    loadEpisodeRating();
    return () => { mounted = false; };
  }, [seriesImdbId, episode.season_number, episode.episode_number, ratingsCache, useOmdbRatings]);

  // ----- collapsible "Your Rating" UI -----
  const [ratingCollapsed, setRatingCollapsed] = useState<boolean>(true); // default collapsed
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Collapse rating when clicking outside rating area (or anywhere in modal besides rating area)
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

  // Keep collapsed when a different episode opens
  useEffect(() => {
    setRatingCollapsed(true);
  }, [episode.id]);

  // star click handler
  const handleStarClick = (n: number) => {
    if (!onRate) return;
    onRate(String(episode.id), n);
  };

  // Collapsed badge — compact
  const CollapsedBadge: React.FC = () => {
    if (typeof userRating === 'number' && userRating > 0) {
      return (
        <button
          onClick={() => setRatingCollapsed(false)}
          className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-slate-900/60 border border-white/10 text-slate-100 text-sm font-semibold"
          aria-label="Show rating controls"
        >
          <Star size={14} className="fill-cyan-400 text-cyan-400" />
          <span className="text-sm">{userRating.toFixed(1)}</span>
        </button>
      );
    }

    return (
      <button
        onClick={() => setRatingCollapsed(false)}
        className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white/5 border border-white/6 text-slate-200 text-sm font-medium"
        aria-label="Open rating controls"
      >
        <Star size={14} />
        <span className="text-sm">Rate</span>
      </button>
    );
  };

  // OMDb / TMDB badges (smaller)
  const OmdbBadges: React.FC = () => {
    if (!useOmdbRatings) return null;
    if (!episodeOmdb || (!episodeOmdb.imdbRating && !episodeOmdb.metascore && !episodeOmdb.rottenTomatoes && tmdbRating === 'N/A')) {
      return null;
    }

    return (
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {episodeOmdb?.imdbRating && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-amber-500/16 border border-amber-500/25">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            <span className="font-semibold text-sm text-amber-300">{parseFloat(episodeOmdb.imdbRating).toFixed(1)}</span>
            <span className="text-[11px] text-amber-200/70 font-medium">IMDb</span>
          </div>
        )}

        {episodeOmdb?.metascore && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-green-500/12 border border-green-500/25">
            <span className="font-semibold text-sm text-green-300">{episodeOmdb.metascore}</span>
            <span className="text-[11px] text-green-200/70 font-medium">Metacritic</span>
          </div>
        )}

        {episodeOmdb?.rottenTomatoes && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-red-500/12 border border-red-500/25">
            <span className="font-semibold text-sm text-red-300">{episodeOmdb.rottenTomatoes}</span>
            <span className="text-[11px] text-red-200/70 font-medium">Rotten</span>
          </div>
        )}

        {/* TMDB tiny pill */}
        {tmdbRating !== 'N/A' && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-cyan-500/8 border border-cyan-500/25">
            <Star size={14} className="fill-cyan-400 text-cyan-400" />
            <span className="font-semibold text-sm text-cyan-300">{tmdbRating}</span>
            <span className="text-[11px] text-cyan-200/70 font-medium">TMDB</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-2"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative max-w-3xl w-full max-h-[calc(var(--vh)*90)] overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl"
      >
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
              src={episode.still_path ? `https://image.tmdb.org/t/p/w780${episode.still_path}` : 'https://picsum.photos/800/450'}
              alt={episode.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

            <div className="absolute bottom-6 left-4 right-4 space-y-1">
              {showTitle && (
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-black/50 text-xs text-slate-200">
                  <Tv size={14} />
                  <span className="font-semibold">{showTitle}</span>
                </div>
              )}
              <h2 className="text-xl md:text-2xl font-bold text-white leading-tight mt-1">
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

            {/* OMDb / TMDB badges (compact) */}
            <OmdbBadges />

            {/* Open in Stremio (episode-aware) */}
            <div className="mt-2">
              <a
                href={stremioEpisodeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[#1b2332]/90 hover:bg-[#252f3f] border border-cyan-500/30 hover:border-cyan-400/60 text-xs font-semibold text-slate-100 transition-all"
              >
                <img src="/stremio-icon.png" alt="Open in Stremio" className="w-5 h-5 rounded-md" />
                <span>Open this episode in Stremio</span>
              </a>
            </div>

            {/* Collapsible user rating control (compact sizes) */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Your Rating</h3>
              <div>
                {ratingCollapsed ? (
                  <CollapsedBadge />
                ) : (
                  <div className="inline-flex items-center gap-2 bg-slate-900/60 border border-white/6 rounded-md px-2 py-1">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                      const active = typeof userRating === 'number' && userRating >= n;
                      return (
                        <button
                          key={n}
                          onClick={() => handleStarClick(n)}
                          className={`p-1 ${active ? 'text-cyan-400' : 'text-slate-600'}`}
                          aria-label={`Rate ${n}`}
                        >
                          <Star size={14} className={active ? 'fill-cyan-400' : 'fill-slate-800'} />
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setRatingCollapsed(true)}
                      className="ml-2 px-2 py-0.5 rounded-md bg-white/6 border border-white/8 text-xs"
                      aria-label="Collapse rating"
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
      </motion.div>
    </motion.div>
  );
};

export default EpisodeDetailView;