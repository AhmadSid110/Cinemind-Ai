import React from 'react';
import { X, Star, Calendar, Tv } from 'lucide-react';
import { EpisodeDetail } from '../services/tmdbService';
import { Review } from '../types';

interface EpisodeDetailViewProps {
  episode: EpisodeDetail;
  showTitle?: string;
  onClose: () => void;
  onRate?: (id: string, rating: number) => void;
  userRating?: number;
}

const EpisodeDetailView: React.FC<EpisodeDetailViewProps> = ({
  episode,
  showTitle,
  onClose,
  onRate,
  userRating,
}) => {
  const airYear = episode.air_date
    ? new Date(episode.air_date).getFullYear()
    : 'N/A';

  const reviews: Review[] =
    (episode.reviews as any)?.results || [];

  const tmdbRating =
    typeof episode.vote_average === 'number'
      ? episode.vote_average.toFixed(1)
      : 'N/A';

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
          {/* Left: poster / still */}
          <div className="relative bg-slate-900">
            <img
              src={
                episode.still_path
                  ? `https://image.tmdb.org/t/p/w780${episode.still_path}`
                  : 'https://picsum.photos/800/450'
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
                S{episode.season_number} · E{episode.episode_number}{' '}
                &mdash; {episode.name}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <Calendar size={14} />
                  {episode.air_date || 'Unknown'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star
                    size={14}
                    className="text-amber-400 fill-amber-400"
                  />
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
              <h3 className="text-sm font-semibold text-slate-200 mb-1">
                Overview
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {episode.overview || 'No synopsis available for this episode.'}
              </p>
            </div>

            {/* Optional user rating control */}
            {onRate && (
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-1">
                  Your Rating
                </h3>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => onRate(String(episode.id), n)}
                      className={`p-1 ${
                        userRating && userRating >= n
                          ? 'text-cyan-400'
                          : 'text-slate-600'
                      }`}
                    >
                      <Star
                        size={16}
                        className={
                          userRating && userRating >= n
                            ? 'fill-cyan-400'
                            : 'fill-slate-800'
                        }
                      />
                    </button>
                  ))}
                </div>
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
                        {typeof rev.author_details?.rating ===
                          'number' && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                            <Star
                              size={12}
                              className="fill-amber-400 text-amber-400"
                            />
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
