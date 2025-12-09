// src/components/DetailView.tsx
import React, { useEffect, useState } from 'react';
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
}

// helper heart so we can pass `filled`
const HeartIcon: React.FC<{
  filled: boolean;
  size?: number;
  className?: string;
}> = ({ filled, size = 20, className = '' }) => (
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
}) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);

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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#030712] text-slate-200 animate-in fade-in zoom-in-95 duration-300 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent selection:bg-cyan-500/30">
      {/* HERO */}
      <div className="relative h-[70vh] w-full group overflow-hidden">
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
          className="absolute top-6 right-6 z-50 bg-black/40 hover:bg-cyan-500/20 text-white p-2.5 rounded-full backdrop-blur-md border border-white/10 hover:border-cyan-400/50 transition-all duration-300 group/close shadow-[0_0_15px_rgba(0,0,0,0.5)]"
        >
          <X
            size={24}
            className="group-hover/close:rotate-90 transition-transform text-slate-300 group-hover/close:text-cyan-400"
          />
        </button>

        {/* HERO CONTENT */}
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 z-20 pt-32">
          <div className="max-w-5xl">
            {/* badges */}
            <div className="flex flex-wrap items-center gap-3 mb-4 animate-in slide-in-from-left-4 duration-500 delay-100">
              {item.status && (
                <span className="bg-cyan-500/20 backdrop-blur-md text-cyan-300 px-3 py-1 rounded-lg text-xs font-bold border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                  {item.status}
                </span>
              )}
              <span className="flex items-center gap-1.5 bg-yellow-500/10 backdrop-blur-md text-yellow-400 px-3 py-1 rounded-lg text-xs font-bold border border-yellow-500/20">
                <Star size={12} fill="currentColor" />
                {item.vote_average?.toFixed(1)}
              </span>
              {item.genres?.map((g) => (
                <span
                  key={g.id}
                  className="bg-white/5 backdrop-blur-md text-slate-300 px-3 py-1 rounded-lg text-xs font-medium border border-white/5"
                >
                  {g.name}
                </span>
              ))}
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 mb-6 drop-shadow-2xl animate-in slide-in-from-left-4 duration-500 delay-200 leading-tight">
              {title}
            </h1>

            <div className="flex flex-wrap items-center gap-6 text-slate-400 text-sm font-medium mb-8 animate-in slide-in-from-left-4 duration-500 delay-300">
              {year && (
                <span className="flex items-center gap-2">
                  <Calendar size={16} className="text-cyan-500" />
                  {year}
                </span>
              )}
              {item.runtime ? (
                <span className="flex items-center gap-2">
                  <Clock size={16} className="text-purple-500" />
                  {Math.floor(item.runtime / 60)}h {item.runtime % 60}m
                </span>
              ) : (
                item.number_of_seasons && (
                  <span className="flex items-center gap-2">
                    <Clock size={16} className="text-purple-500" />
                    {item.number_of_seasons} Seasons
                  </span>
                )
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 animate-in slide-in-from-bottom-4 duration-500 delay-400">
              {trailer && (
                <a
                  href={`https://www.youtube.com/watch?v=${trailer.key}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-3 transition-all hover:scale-105 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                >
                  <Play size={20} fill="currentColor" /> Watch Trailer
                </a>
              )}

              {/* Favorite */}
              <button
                onClick={() => onToggleFavorite(item)}
                className={`px-6 py-3.5 rounded-xl font-bold flex items-center gap-3 transition-all border backdrop-blur-md hover:scale-105 ${
                  isFavorite
                    ? 'bg-pink-500/20 border-pink-500 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.3)]'
                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <HeartIcon filled={isFavorite} />
                {isFavorite ? 'Favorited' : 'Favorite'}
              </button>

              {/* Watchlist */}
              <button
                onClick={() => onToggleWatchlist(item)}
                className={`px-6 py-3.5 rounded-xl font-bold flex items-center gap-3 transition-all border backdrop-blur-md hover:scale-105 ${
                  isWatchlist
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                }`}
              >
                {isWatchlist ? <Check size={20} /> : <Plus size={20} />}
                {isWatchlist ? 'On Watchlist' : 'Watchlist'}
              </button>

              {/* Open in Stremio */}
              <a
                href={stremioUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-[#1b2332]/90 hover:bg-[#252f3f] text-slate-100 px-6 py-3.5 rounded-xl font-bold flex items-center gap-3 transition-all hover:scale-105 border border-cyan-500/30 hover:border-cyan-400/60 backdrop-blur-md"
              >
                <img
                  src="/stremio-icon.png"
                  alt="Open in Stremio"
                  className="w-6 h-6 rounded-md"
                />
                <span>Open in Stremio</span>
              </a>

              {/* Letterboxd */}
              <a
                href={letterboxdUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-[#202830]/80 hover:bg-[#2c3440] text-slate-200 px-6 py-3.5 rounded-xl font-bold flex items-center gap-3 transition-all hover:scale-105 border border-white/5 hover:border-white/10 backdrop-blur-md"
              >
                <ExternalLink size={20} />
                Letterboxd
              </a>
            </div>

            {/* User rating */}
            <div className="mt-6 animate-in slide-in-from-bottom-4 duration-500 delay-500">
              <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-xl p-4 inline-block">
                <p className="text-sm text-slate-400 mb-2 font-medium">
                  Your Rating:
                </p>
                <StarRating
                  value={userMediaRating}
                  onChange={(rating) => onRate(mediaKey, rating)}
                  size={24}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-6 pb-20 -mt-10 relative z-30">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* LEFT: overview, cast, crew, reviews */}
          <div className="lg:col-span-2 space-y-12">
            {/* Tagline & overview */}
            <div className="bg-[#0b1221]/80 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-xl">
              {item.tagline && (
                <h3 className="text-xl md:text-2xl font-light italic text-cyan-200/80 mb-4 font-serif">
                  "{item.tagline}"
                </h3>
              )}
              <p className="text-slate-300 leading-8 text-lg font-light">
                {item.overview}
              </p>
            </div>

            {/* Cast */}
            <section>
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="w-1 h-6 bg-cyan-500 rounded-full shadow-[0_0_10px_#06b6d4]" />
                Top Cast
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {cast.map((person) => (
                  <div
                    key={person.id}
                    onClick={() => onCastClick(person.id)}
                    className="group bg-[#0f172a] rounded-xl p-3 border border-white/5 hover:border-cyan-500/50 hover:bg-[#162032] transition-all cursor-pointer flex items-center gap-3"
                  >
                    <img
                      src={
                        person.profile_path
                          ? `https://image.tmdb.org/t/p/w200${person.profile_path}`
                          : 'https://via.placeholder.com/200'
                      }
                      alt={person.name}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-cyan-500 transition-all"
                    />
                    <div className="overflow-hidden">
                      <p className="text-slate-200 font-bold text-sm truncate group-hover:text-cyan-400 transition-colors">
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
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <span className="w-1 h-6 bg-purple-500 rounded-full shadow-[0_0_10px_#a855f7]" />
                  Creative Team
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {crew.map((person) => (
                    <div
                      key={`crew-${person.id}-${person.job}`}
                      onClick={() => onCastClick(person.id)}
                      className="group bg-[#0f172a] rounded-xl p-3 border border-white/5 hover:border-purple-500/50 hover:bg-[#162032] transition-all cursor-pointer"
                    >
                      <p className="text-slate-200 font-bold text-sm truncate group-hover:text-purple-400 transition-colors">
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
                <section className="mt-6 space-y-3">
                  <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <span className="w-1 h-6 bg-amber-500 rounded-full shadow-[0_0_10px_#f59e0b]" />
                    TMDB Reviews
                  </h3>
                  <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
                    {item.reviews.results.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-4 rounded-xl bg-[#0f172a] border border-white/5 hover:border-amber-500/30 transition-all"
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
                                size={14}
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
          </div>

          {/* RIGHT: seasons / episodes chart */}
          <div className="lg:col-span-1 space-y-8">
            {item.media_type === 'tv' && item.seasons && (
              <div className="bg-[#0b1221]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl sticky top-24">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <MonitorPlay className="text-cyan-400" size={20} />
                    Season {selectedSeason}
                  </h3>
                  <div className="relative">
                    <select
                      value={selectedSeason}
                      onChange={(e) =>
                        setSelectedSeason(Number(e.target.value))
                      }
                      className="bg-slate-900 text-white border border-slate-700 rounded-lg py-2 pl-3 pr-8 appearance-none focus:border-cyan-500 focus:outline-none cursor-pointer text-sm font-bold"
                    >
                      {item.seasons
                        .filter((s) => s.season_number > 0)
                        .map((s) => (
                          <option
                            key={s.id}
                            value={s.season_number}
                          >
                            Season {s.season_number} ({s.episode_count}{' '}
                            eps)
                          </option>
                        ))}
                    </select>
                    <ChevronDown
                      className="absolute right-2 top-2.5 text-slate-400 pointer-events-none"
                      size={16}
                    />
                  </div>
                </div>

                {/* Rating bar chart */}
  