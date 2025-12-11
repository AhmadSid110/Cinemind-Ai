// src/components/EpisodeDetailView.tsx
import React from 'react';
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
  /**
   * Optional ratings cache object that should expose:
   *   getCached(mediaType: string, id: number): { imdbRating?: string, metascore?: string, rottenTomatoes?: string } | null
   */
  ratingsCache?: {
    getCached: (mediaType: string, id: number) => any;
  } | null;
  /** Whether to attempt using OMDb/IMDb ratings from ratingsCache */
  useOmdbRatings?: boolean;
}

const EpisodeDetailView: React.FC<EpisodeDetailViewProps> = ({
  episode,
  showTitle,
  onClose,
  onRate,
  userRating,
  ratingsCache = null,
  useOmdbRatings = true,
}) => {
  // Safe extraction of basic fields
  const airDate = episode && typeof episode.air_date === 'string' ? episode.air_date : undefined;
  const airYear = airDate ? new Date(airDate).getFullYear() : undefined;

  const reviews: Review[] = (episode && (episode.reviews?.results || [])) as Review[];

  // TMDB rating (string for display)
  const tmdbRating =
    typeof episode.vote_average === 'number' ? episode.vote_average.toFixed(1) : undefined;

  // Series-level IDs: these should be injected by App (see your flow), otherwise try external_ids
  const seriesImdbId: string | undefined =
    (episode as any).show_imdb_id ||
    ((episode as any).external_ids && (episode as any).external_ids.imdb_id) ||
    undefined;

  const seriesTvdbId: number | undefined =
    typeof (episode as any).show_tvdb_id === 'number'
      ? (episode as any).show_tvdb_id
      : typeof (episode as any).external_ids?.tvdb_id === 'number'
      ? (episode as any).external_ids.tvdb_id
      : undefined;

  // Build Stremio deep link context (series + season + episode)
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

  // Try to get cached OMDb/IMDb ratings (optional)
  let cachedRating: any = null;
  if (useOmdbRatings && ratingsCache && typeof ratingsCache.getCached === 'function') {
    try {
      cachedRating = ratingsCache.getCached('tv', (episode as any).show_id || (episode as any).show?.id || (episode as any).id) || null;
      // Note: calling getCached with the show id is recommended — ensure your cache key logic matches
    } catch (err) {
      // swallow any cache errors
      cachedRating = null;
    }
  }

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
              alt={episode.name || 'Episode image'}
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
                  {airDate || 'Unknown'}
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

              {/* Optional: show compact IMDb/Metacritic/RT badge if cachedRating exists */}
              {cachedRating && (cachedRating.imdbRating || cachedRating.metascore || cachedRating.rottenTomatoes) && (
                <div className="mt-2 flex items-center gap-2">
                  {cachedRating.imdbRating && (
                    <div className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 text-xs font-semibold border border-amber-500/20">
                      {parseFloat(cachedRating.imdbRating).toFixed(1)} IMDb
                    </div>
                  )}
                  {cachedRating.metascore && (
                    <div className="px-2 py-1 rounded-md bg-green-500/10 text-green-300 text-xs font-semibold border border-green-500/20">
                      {cachedRating.metascore} Metacritic
                    </div>
                  )}
                  {cachedRating.rottenTomatoes && (
                    <div className="px-2 py-1 rounded-md bg-red-500/10 text-red-300 text-xs font-semibold border border-red-500/20">
                      {cachedRating.rottenTomatoes} RT
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: details */}
          <div className="p-4 md:p-6 flex flex-col gap-4 overflow-y-auto">
            {/* Overview */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Overview</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {episode.overview && episode.overview.length > 0
                  ? episode.overview
                  : 'No synopsis available for this episode.'}
              </p>
            </div>

            {/* Open in Stremio (episode-aware) */}
            <div className="mt-2">
              <a
                href={stremioEpisodeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1b2332]/90 hover:bg-[#252f3f] border border-cyan-500/40 hover:border-cyan-400/70 text-xs font-semibold text-slate-100 transition-all"
                aria-label="Open in Stremio"
              >
                <img src="/stremio-icon.png" alt="Open in Stremio" className="w-5 h-5 rounded-md" />
                <span>Open this episode in Stremio</span>
              </a>
            </div>

            {/* User rating control (collapsible behavior left to parent / other component if desired) */}
            {onRate && (
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-1">Your Rating</h3>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => onRate(String(episode.id), n)}
                      className={`p-1 ${userRating && userRating >= n ? 'text-cyan-400' : 'text-slate-600'}`}
                      aria-label={`Rate ${n}`}
                    >
                      <Star
                        size={16}
                        className={userRating && userRating >= n ? 'fill-cyan-400' : 'fill-slate-800'}
                      />
                    </button>
                  ))}
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
                          {rev.author || rev.author_details?.username || 'User'}
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

            {reviews.length === 0 && (
              <p className="text-xs text-slate-500">No TMDB reviews available for this episode yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EpisodeDetailView;