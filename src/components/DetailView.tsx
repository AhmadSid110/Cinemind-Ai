// src/components/DetailView.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Play,
  Plus,
  Check,
  Star,
  Calendar,
  Clock,
  Video,
  ChevronDown,
  MonitorPlay,
  ExternalLink,
  Heart as LucideHeart,
  ChevronUp,
  ChevronRight,
} from 'lucide-react';

import { MediaDetail, MediaItem, Episode, CrewMember } from '../types';
import { getSeasonEpisodes } from '../services/tmdbService';
import { generateMediaKey } from '../utils';
import StarRating from './StarRating';
import {
  buildStremioMediaUrl,
  StremioMediaContext,
} from '../utils/stremio';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

interface DetailViewProps {
  item: MediaDetail;
  onClose: () => void;
  apiKey: string;
  onToggleFavorite: (item: MediaItem) => void;
  onToggleWatchlist: (item: MediaItem) => void;
  isFavorite: boolean;
  isWatchlist: boolean;
  onCastClick: (personId: number) => void;
  onEpisodeClick?: (
    showId: number,
    seasonNumber: number,
    episodeNumber: number
  ) => void;
  userRatings: { [key: string]: number };
  onRate: (itemId: string, rating: number) => void;
  ratingsCache?: any;
  useOmdbRatings?: boolean;
  showEpisodeImdbOnSeasonList?: boolean;
}

const HeartIcon: React.FC<{
  filled: boolean;
  size?: number;
  className?: string;
}> = ({ filled, size = 18, className = '' }) => (
  <LucideHeart
    size={size}
    className={`${className} ${filled ? 'fill-current' : ''}`}
  />
);

const DetailView: React.FC<DetailViewProps> = ({
  item,
  onClose,
  apiKey,
  onToggleFavorite,
  onToggleWatchlist,
  isFavorite,
  isWatchlist,
  onCastClick,
  onEpisodeClick,
  userRatings,
  onRate,
  ratingsCache,
  useOmdbRatings = true,
  showEpisodeImdbOnSeasonList = false,
}) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  // UI states
  const [addToOpen, setAddToOpen] = useState(false);
  const addToRef = useRef<HTMLButtonElement | null>(null);

  const [ratingExpanded, setRatingExpanded] = useState(false);

  // Initial season for TV shows
  useEffect(() => {
    if (item.media_type === 'tv' && item.seasons) {
      const seasonToLoad =
        item.seasons.find((s) => s.season_number > 0)?.season_number || 1;
      setSelectedSeason(seasonToLoad);
    }
  }, [item]);

  // Fetch episodes when season changes
  useEffect(() => {
    if (item.media_type === 'tv' && item.seasons && selectedSeason) {
      const fetchEpisodes = async () => {
        try {
          setLoadingEpisodes(true);
          const data = await getSeasonEpisodes(
            apiKey,
            item.id,
            selectedSeason
          );
          setEpisodes(data);
        } finally {
          setLoadingEpisodes(false);
        }
      };
      fetchEpisodes();
    }
  }, [item, apiKey, selectedSeason]);

  // Close AddTo popup when clicking outside
  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (addToRef.current && !addToRef.current.contains(target)) {
        setAddToOpen(false);
      }
    };
    if (addToOpen) document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [addToOpen]);

  const backdropUrl = item.backdrop_path
    ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
    : 'https://picsum.photos/1920/1080';

  const title = item.title || item.name || '';
  const year =
    item.release_date || item.first_air_date
      ? new Date(
          (item.release_date as string) ||
            (item.first_air_date as string)
        ).getFullYear()
      : undefined;

  const trailer = item.videos?.results.find(
    (v) => v.type === 'Trailer' && v.site === 'YouTube'
  );

  // Crew (director / writer / creator)
  const crew: CrewMember[] =
    item.credits?.crew
      ?.filter((c) =>
        ['Director', 'Executive Producer', 'Writer', 'Screenplay', 'Creator'].includes(
          c.job
        )
      )
      .reduce((acc, current) => {
        const exists = acc.find((x) => x.id === current.id);
        if (!exists) return acc.concat([current]);
        return acc;
      }, [] as CrewMember[])
      .slice(0, 6) || [];

  const cast = item.credits?.cast.slice(0, 10) || [];

  // Letterboxd link
  const letterboxdUrl =
    item.media_type === 'movie'
      ? `https://letterboxd.com/tmdb/${item.id}`
      : `https://letterboxd.com/search/${encodeURIComponent(title)}`;

  // === STREMIO DEEP LINK (movie / series) ===
  const externalIds = (item as any).external_ids || {};
  const imdbId: string | undefined =
    (item as any).imdb_id ||
    externalIds.imdb_id ||
    undefined;
  const tvdbId: number | undefined =
    typeof externalIds.tvdb_id === 'number'
      ? externalIds.tvdb_id
      : undefined;

  const stremioCtx: StremioMediaContext = {
    title,
    year,
    type: item.media_type === 'movie' ? 'movie' : 'series',
    imdbId,
    tvdbId,
  };

  const stremioUrl = buildStremioMediaUrl(stremioCtx);

  // Rating key
  const mediaKey = generateMediaKey(
    item.media_type as 'movie' | 'tv',
    item.id
  );
  const userMediaRating = userRatings[mediaKey] || 0;

  // Get cached OMDb ratings if available AND OMDb is enabled
  const cachedRating = useOmdbRatings && ratingsCache && item.media_type !== 'person'
    ? ratingsCache.getCached(item.media_type, item.id)
    : null;

  // UI helpers: smaller badge classes
  const badgeBase =
    'flex items-center gap-2 px-3 py-1 rounded-md text-sm font-semibold';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#030712] text-slate-200 animate-in fade-in zoom-in-95 duration-300 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent selection:bg-cyan-500/30">
      {/* HERO */}
      <div className="relative h-[calc(var(--vh)*62)] w-full group overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={backdropUrl}
            alt={title}
            className="w-full h-full object-cover transition duration-[3s] group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-[#030712]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#030712] via-[#030712]/80 to-transparent" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 mix-blend-overlay" />
        </div>

        {/* CLOSE */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-50 bg-black/40 hover:bg-cyan-500/20 text-white p-2 rounded-full backdrop-blur-md border border-white/10 hover:border-cyan-400/50 transition-all duration-300 group/close"
          aria-label="Close"
        >
          <X
            size={20}
            className="transition-transform text-slate-300 group-hover/close:text-cyan-400"
          />
        </button>

        {/* HERO CONTENT */}
        <div className="absolute bottom-6 md:bottom-8 left-4 right-4 z-20">
          <div className="max-w-5xl">
            {/* badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {item.status && (
                <span className="bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-md text-xs font-bold border border-cyan-500/30">
                  {item.status}
                </span>
              )}

              <span className="flex items-center gap-2 bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-md text-sm font-bold border border-yellow-500/20">
                <Star size={12} fill="currentColor" />
                {item.vote_average?.toFixed(1)}
              </span>

              {item.genres?.map((g) => (
                <span
                  key={g.id}
                  className="bg-white/5 text-slate-300 px-2 py-0.5 rounded-md text-sm font-medium border border-white/5"
                >
                  {g.name}
                </span>
              ))}
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 mb-2 drop-shadow-2xl leading-tight mt-1">
              {title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-slate-400 text-sm font-medium mb-3">
              {year && (
                <span className="flex items-center gap-2 text-sm">
                  <Calendar size={14} className="text-cyan-500" />
                  {year}
                </span>
              )}
              {item.runtime ? (
                <span className="flex items-center gap-2 text-sm">
                  <Clock size={14} className="text-purple-500" />
                  {Math.floor(item.runtime / 60)}h {item.runtime % 60}m
                </span>
              ) : (
                item.number_of_seasons && (
                  <span className="flex items-center gap-2 text-sm">
                    <Clock size={14} className="text-purple-500" />
                    {item.number_of_seasons} Seasons
                  </span>
                )
              )}
            </div>

            {/* Ratings row (smaller badges) */}
            {(cachedRating?.imdbRating || cachedRating?.metascore || cachedRating?.rottenTomatoes || item.vote_average) && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {cachedRating?.imdbRating && (
                  <div
                    className={`${badgeBase} bg-amber-500/10 border border-amber-500/30 text-amber-300`}
                    title="IMDb rating"
                  >
                    <Star size={14} className="text-amber-400 fill-amber-400" />
                    <span className="text-sm font-bold">
                      {parseFloat(cachedRating.imdbRating).toFixed(1)}
                    </span>
                    <span className="text-[11px] text-amber-200/70 font-medium">IMDb</span>
                  </div>
                )}

                {cachedRating?.metascore && (
                  <div
                    className={`${badgeBase} bg-green-500/10 border border-green-500/30 text-green-300`}
                    title="Metacritic"
                  >
                    <span className="text-sm font-bold">{cachedRating.metascore}</span>
                    <span className="text-[11px] text-green-200/70 font-medium">Metacritic</span>
                  </div>
                )}

                {cachedRating?.rottenTomatoes && (
                  <div
                    className={`${badgeBase} bg-red-500/10 border border-red-500/30 text-red-300`}
                    title="Rotten Tomatoes"
                  >
                    <span className="text-sm font-bold">{cachedRating.rottenTomatoes}</span>
                    <span className="text-[11px] text-red-200/70 font-medium">RT</span>
                  </div>
                )}

                {item.vote_average && (
                  <div
                    className={`${badgeBase} bg-cyan-500/10 border border-cyan-500/30 text-cyan-300`}
                    title="TMDB rating"
                  >
                    <Star size={14} className="text-cyan-400 fill-cyan-400" />
                    <span className="text-sm font-bold">{item.vote_average.toFixed(1)}</span>
                    <span className="text-[11px] text-cyan-200/70 font-medium">TMDB</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {trailer && (
                <a
                  href={`https://www.youtube.com/watch?v=${trailer.key}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-md font-bold flex items-center gap-2 transition-all hover:scale-105"
                >
                  <Play size={16} /> Watch Trailer
                </a>
              )}

              {/* Combined Add To popup (replaces separate Favorite / Watchlist buttons) */}
              <div className="relative inline-block">
                <button
                  ref={addToRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddToOpen((s) => !s);
                  }}
                  className="px-4 py-2 rounded-md font-bold flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10"
                >
                  <Plus size={16} />
                  <span>Add to</span>
                  <ChevronDown size={16} />
                </button>

                {addToOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute mt-2 right-0 w-40 bg-[#0b1221]/90 border border-white/10 rounded-lg shadow-xl p-2 z-40"
                  >
                    <button
                      onClick={() => {
                        onToggleFavorite(item as MediaItem);
                        setAddToOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-3 ${
                        isFavorite ? 'bg-pink-600/10 text-pink-300' : 'hover:bg-white/5'
                      }`}
                    >
                      <HeartIcon filled={isFavorite} />
                      <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>
                    </button>

                    <button
                      onClick={() => {
                        onToggleWatchlist(item as MediaItem);
                        setAddToOpen(false);
                      }}
                      className={`w-full text-left mt-2 px-3 py-2 rounded-md flex items-center gap-3 ${
                        isWatchlist ? 'bg-emerald-600/10 text-emerald-300' : 'hover:bg-white/5'
                      }`}
                    >
                      {isWatchlist ? <Check size={16} /> : <Plus size={16} />}
                      <span>{isWatchlist ? 'On Watchlist' : 'Watchlist'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Open in Stremio */}
              <a
                href={stremioUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-[#1b2332]/90 hover:bg-[#252f3f] text-slate-100 px-4 py-2 rounded-md font-bold flex items-center gap-2"
              >
                <img src="/stremio-icon.png" alt="Open in Stremio" className="w-5 h-5 rounded-sm" />
                <span>Open in Stremio</span>
              </a>

              {/* Letterboxd */}
              <a
                href={letterboxdUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-[#202830]/80 hover:bg-[#2c3440] text-slate-200 px-3 py-2 rounded-md font-semibold flex items-center gap-2"
              >
                <ExternalLink size={14} />
                Letterboxd
              </a>
            </div>

            {/* Collapsible User Rating */}
            <div className="mt-4">
              {!ratingExpanded ? (
                <div className="inline-flex items-center gap-2 bg-slate-900/60 border border-white/10 rounded-md px-3 py-1">
                  <button
                    onClick={() => setRatingExpanded(true)}
                    className="flex items-center gap-2 text-sm font-semibold"
                    aria-label="Expand rating"
                  >
                    {userMediaRating > 0 ? (
                      <>
                        <span className="text-cyan-300 font-bold">{userMediaRating.toFixed(1)}</span>
                        <Star size={14} className="fill-cyan-400 text-cyan-400" />
                      </>
                    ) : (
                      <>
                        <span className="text-slate-400">—</span>
                        <Star size={14} className="fill-slate-600" />
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setRatingExpanded(true)}
                    className="ml-2 px-2 py-0.5 rounded bg-white/5 text-xs"
                    aria-label="Edit rating"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              ) : (
                <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-xl p-3 inline-block">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-slate-400 mb-0">Your Rating:</p>
                    <StarRating
                      value={userMediaRating}
                      onChange={(rating) => onRate(mediaKey, rating)}
                      size={20}
                    />
                    <button
                      onClick={() => setRatingExpanded(false)}
                      className="ml-3 px-2 py-1 rounded bg-white/5 text-sm"
                      aria-label="Collapse rating"
                    >
                      <ChevronUp size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-6 pb-20 -mt-8 relative z-30">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: overview, cast, crew, reviews */}
          <div className="lg:col-span-2 space-y-8">
            {/* Tagline & overview */}
            <div className="bg-[#0b1221]/80 backdrop-blur-xl border border-white/5 p-6 rounded-2xl shadow-md">
              {item.tagline && (
                <h3 className="text-lg md:text-xl font-light italic text-cyan-200/80 mb-3 font-serif">
                  "{item.tagline}"
                </h3>
              )}
              <p className="text-slate-300 leading-7 text-base">
                {item.overview}
              </p>
            </div>

            {/* Cast */}
            <section>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-1 h-6 bg-cyan-500 rounded-full" />
                Top Cast
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {cast.map((person) => (
                  <div
                    key={person.id}
                    onClick={() => onCastClick(person.id)}
                    className="group bg-[#0f172a] rounded-lg p-2 border border-white/5 hover:border-cyan-500/50 hover:bg-[#162032] transition-all cursor-pointer flex items-center gap-3"
                  >
                    <img
                      src={
                        person.profile_path
                          ? `https://image.tmdb.org/t/p/w200${person.profile_path}`
                          : 'https://via.placeholder.com/200'
                      }
                      alt={person.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-cyan-500 transition-all"
                    />
                    <div className="overflow-hidden">
                      <p className="text-slate-200 font-semibold text-sm truncate group-hover:text-cyan-400 transition-colors">
                        {person.name}
                      </p>
                      <p className="text-slate-500 text-xs truncate">
                        {person.character}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Crew */}
            {crew.length > 0 && (
              <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                  <span className="w-1 h-6 bg-purple-500 rounded-full" />
                  Creative Team
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {crew.map((person) => (
                    <div
                      key={`crew-${person.id}-${person.job}`}
                      onClick={() => onCastClick(person.id)}
                      className="group bg-[#0f172a] rounded-lg p-2 border border-white/5 hover:border-purple-500/50 hover:bg-[#162032] transition-all cursor-pointer"
                    >
                      <p className="text-slate-200 font-semibold text-sm truncate group-hover:text-purple-400 transition-colors">
                        {person.name}
                      </p>
                      <p className="text-slate-500 text-xs truncate">
                        {person.job}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* TMDB reviews */}
            {item.reviews &&
              item.reviews.results &&
              item.reviews.results.length > 0 && (
                <section className="mt-4 space-y-3">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="w-1 h-6 bg-amber-500 rounded-full" />
                    TMDB Reviews
                  </h3>
                  <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                    {item.reviews.results.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-3 rounded-lg bg-[#0f172a] border border-white/5 hover:border-amber-500/30 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-slate-100">
                            {rev.author ||
                              rev.author_details.username ||
                              'User'}
                          </span>
                          {typeof rev.author_details?.rating ===
                            'number' && (
                            <span className="inline-flex items-center gap-1 text-sm text-amber-300">
                              <Star
                                size={12}
                                className="fill-amber-400 text-amber-400"
                              />
                              {rev.author_details.rating.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-300 line-clamp-6 leading-relaxed">
                          {rev.content}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          {new Date(
                            rev.created_at
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

            {/* IMDb Reviews - Button to view on IMDb */}
            {imdbId && (
              <section className="mt-4 space-y-3">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                  <span className="w-1 h-6 bg-[#f5c518] rounded-full" />
                  IMDb Reviews
                </h3>
                <div className="p-4 rounded-lg bg-[#0f172a] border border-white/5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <Star className="text-[#f5c518]" size={24} />
                    </div>
                    <div className="flex-1 space-y-3">
                      {cachedRating?.imdbRating && (
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-slate-100">
                            {cachedRating.imdbRating}
                          </span>
                          <span className="text-sm text-slate-400">/10</span>
                          {cachedRating.imdbVotes && (
                            <span className="text-xs text-slate-500 ml-2">
                              ({cachedRating.imdbVotes} votes)
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-slate-400">
                        Read detailed reviews and ratings from the IMDb community
                      </p>
                      <a
                        href={`https://www.imdb.com/title/${imdbId}/reviews`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f5c518] text-black font-semibold text-sm hover:bg-[#e2b616] transition-all duration-300 shadow-lg hover:shadow-[#f5c518]/20"
                      >
                        <ExternalLink size={16} />
                        View All IMDb Reviews
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* RIGHT: seasons / episodes chart */}
          <div className="lg:col-span-1 space-y-6">
            {item.media_type === 'tv' && item.seasons && (
              <div className="bg-[#0b1221]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-md sticky top-20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <MonitorPlay className="text-cyan-400" size={18} />
                    Season {selectedSeason}
                  </h3>
                  <div className="relative">
                    <select
                      value={selectedSeason}
                      onChange={(e) =>
                        setSelectedSeason(Number(e.target.value))
                      }
                      className="bg-slate-900 text-white border border-slate-700 rounded-md py-1 pl-2 pr-8 appearance-none focus:border-cyan-500 focus:outline-none cursor-pointer text-sm font-bold"
                    >
                      {item.seasons
                        .filter((s) => s.season_number > 0)
                        .map((s) => (
                          <option
                            key={s.id}
                            value={s.season_number}
                          >
                            S{s.season_number} ({s.episode_count})
                          </option>
                        ))}
                    </select>
                    <ChevronDown
                      className="absolute right-2 top-2 text-slate-400 pointer-events-none"
                      size={14}
                    />
                  </div>
                </div>

                {/* Rating bar chart */}
                <div className="h-36 w-full mb-3">
                  {loadingEpisodes ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="w-7 h-7 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : episodes.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={episodes}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#1e293b"
                        />
                        <XAxis dataKey="episode_number" hide />
                        <YAxis domain={[0, 10]} hide />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '8px',
                            color: '#fff',
                          }}
                          itemStyle={{ color: '#22d3ee' }}
                          cursor={{
                            fill: '#334155',
                            opacity: 0.4,
                          }}
                          formatter={(value: number) => [
                            value.toFixed(1),
                            'Rating',
                          ]}
                          labelFormatter={(label) =>
                            `Episode ${label}`
                          }
                        />
                        <Bar dataKey="vote_average" radius={[4, 4, 0, 0]}>
                          {episodes.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill="url(#colorGradient)"
                            />
                          ))}
                        </Bar>
                        <defs>
                          <linearGradient
                            id="colorGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#06b6d4"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#3b82f6"
                              stopOpacity={0.3}
                            />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center text-slate-500 text-sm py-8">
                      No rating data available
                    </div>
                  )}
                </div>

                {/* Episode list */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {episodes.map((ep) => {
                    // Get episode-level IMDb rating if enabled
                    let episodeRating = ep.vote_average?.toFixed(1) || 'N/A';
                    let isImdbRating = false;
                    
                    if (showEpisodeImdbOnSeasonList && useOmdbRatings && ratingsCache) {
                      const seriesImdbId = (item as any).external_ids?.imdb_id;
                      if (seriesImdbId && typeof ratingsCache.getEpisodeCached === 'function') {
                        const episodeOmdb = ratingsCache.getEpisodeCached(seriesImdbId, ep.season_number, ep.episode_number);
                        if (episodeOmdb?.imdbRating) {
                          episodeRating = episodeOmdb.imdbRating;
                          isImdbRating = true;
                        }
                      }
                    }
                    
                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() =>
                          onEpisodeClick &&
                          onEpisodeClick(
                            item.id,
                            ep.season_number,
                            ep.episode_number
                          )
                        }
                        className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-slate-900/60 hover:bg-slate-800 border border-slate-700/70 hover:border-cyan-500/50 text-left text-sm"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-100">
                            S{ep.season_number} · E{ep.episode_number} — {ep.name}
                          </span>
                          <span className="text-xs text-slate-400 line-clamp-1">
                            {ep.overview}
                          </span>
                        </div>
                        <div className={`flex items-center gap-1 text-xs ${isImdbRating ? 'text-amber-400' : 'text-amber-300'}`}>
                          <Star size={12} className={`${isImdbRating ? 'fill-amber-500 text-amber-500' : 'fill-amber-400 text-amber-400'}`} />
                          {episodeRating}
                        </div>
                      </button>
                    );
                  })}
                  {episodes.length === 0 && !loadingEpisodes && (
                    <p className="text-xs text-slate-500 text-center py-4">
                      No episodes found for this season.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* If not TV show, simple info card */}
            {item.media_type !== 'tv' && (
              <div className="bg-[#0b1221]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-md flex flex-col items-center justify-center gap-3">
                <Video size={28} className="text-slate-500" />
                <p className="text-sm text-slate-400 text-center">
                  This title is a movie – explore similar films from the home screen.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailView;