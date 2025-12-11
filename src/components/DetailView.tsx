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
  MonitorPlay,
  ExternalLink,
  ChevronDown,
  Heart as LucideHeart,
} from 'lucide-react';
import { MediaDetail, MediaItem, Episode, CrewMember } from '../types';
import { getSeasonEpisodes } from '../services/tmdbService';
import { generateMediaKey } from '../utils';
import StarRating from './StarRating';
import { buildStremioSearchUrl } from '../utils/stremio';

interface DetailViewProps {
  item: MediaDetail;
  onClose: () => void;
  apiKey: string;
  onToggleFavorite: (item: MediaItem) => void;
  onToggleWatchlist: (item: MediaItem) => void;
  isFavorite: boolean;
  isWatchlist: boolean;
  onCastClick: (personId: number) => void;
  onEpisodeClick?: (showId: number, seasonNumber: number, episodeNumber: number) => void;
  userRatings: { [key: string]: number };
  onRate: (itemId: string, rating: number) => void;
}

/**
 * Small combined "Add to" popup component used inside DetailView
 * - toggles favorite / watchlist
 */
const AddToPopup: React.FC<{
  isFavorite: boolean;
  isWatchlist: boolean;
  onToggleFavorite: () => void;
  onToggleWatchlist: () => void;
}> = ({ isFavorite, isWatchlist, onToggleFavorite, onToggleWatchlist }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="px-5 py-2 rounded-lg bg-slate-900/70 hover:bg-slate-800 text-sm font-semibold flex items-center gap-2 border border-white/5"
        aria-expanded={open}
      >
        <Plus size={16} />
        Add to
        <ChevronDown size={14} className="ml-1" />
      </button>

      {open && (
        <div
          className="absolute mt-2 right-0 w-44 bg-[#081019] border border-white/6 rounded-lg shadow-xl p-2 z-40"
          role="menu"
        >
          <button
            onClick={() => {
              onToggleFavorite();
              setOpen(false);
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/5 transition"
          >
            <LucideHeart
              size={18}
              className={`${isFavorite ? 'text-pink-400 fill-current' : 'text-slate-400'}`}
            />
            <span className="text-sm">{isFavorite ? 'Favorited' : 'Add to Favorites'}</span>
          </button>

          <button
            onClick={() => {
              onToggleWatchlist();
              setOpen(false);
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/5 transition mt-1"
          >
            {isWatchlist ? <Check size={18} /> : <Plus size={18} />}
            <span className="text-sm">{isWatchlist ? 'On Watchlist' : 'Add to Watchlist'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

// compact heart used in AddToPopup preview button (if needed)
const HeartIcon: React.FC<{ filled: boolean; size?: number; className?: string }> = ({
  filled,
  size = 18,
  className = '',
}) => (
  <LucideHeart
    size={size}
    className={`${className} ${filled ? 'fill-current text-pink-400' : 'text-slate-400'}`}
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

  // collapsed rating state (true = compact / collapsed)
  const [ratingCollapsed, setRatingCollapsed] = useState<boolean>(true);

  // Load initial season for TV shows
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
          const data = await getSeasonEpisodes(apiKey, item.id, selectedSeason);
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

  const title = item.title || item.name;
  const year =
    item.release_date || item.first_air_date
      ? new Date(item.release_date || item.first_air_date || '').getFullYear()
      : undefined;
  const trailer = item.videos?.results.find(
    (v) => v.type === 'Trailer' && v.site === 'YouTube'
  );

  // Filter crew to important roles (unchanged)
  const crew =
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

  // Letterboxd URL
  const letterboxdUrl =
    item.media_type === 'movie'
      ? `https://letterboxd.com/tmdb/${item.id}`
      : `https://letterboxd.com/search/${encodeURIComponent(title || '')}`;

  const stremioUrl = buildStremioSearchUrl({
    title: title || '',
    year: year || undefined,
  });

  const mediaKey = generateMediaKey(item.media_type as 'movie' | 'tv', item.id);
  const userMediaRating = userRatings[mediaKey] || 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#030712] text-slate-200 animate-in fade-in zoom-in-95 duration-300 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent selection:bg-cyan-500/30">
      {/* HERO — smaller badges & compressed layout */}
      <div className="relative h-[60vh] w-full group overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={backdropUrl}
            alt={title}
            className="w-full h-full object-cover transition duration-[3s] group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-[#030712]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#030712] via-[#030712]/80 to-transparent" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 brightness-100 mix-blend-overlay" />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-50 bg-black/40 hover:bg-cyan-500/20 text-white p-2 rounded-full backdrop-blur-md border border-white/10 transition-all"
        >
          <X size={22} />
        </button>

        {/* Hero content (compressed) */}
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-10 z-20">
          <div className="max-w-5xl">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-300 leading-tight">
                {title}
              </h1>

              {year && (
                <span className="text-sm text-slate-300/80 bg-white/3 px-2 py-1 rounded-md">
                  {year}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Compact rating badges */}
              <div className="flex items-center gap-2">
                {/* IMDb badge placeholder (if present in your state) */}
                {/* Adjusted styling: smaller badge */}
                {item.vote_average !== undefined && (
                  <div className="px-3 py-1 rounded-md text-sm font-semibold bg-yellow-600/10 text-yellow-300 border border-yellow-500/20 shadow-sm">
                    <Star size={14} className="inline mr-1 -mt-1" />{' '}
                    {item.vote_average?.toFixed(1)}
                  </div>
                )}

                {/* If you have other badges (Metacritic, RottenTomatoes) add them similarly */}
              </div>

              {/* Action buttons row */}
              <div className="flex items-center gap-2 ml-2">
                {trailer && (
                  <a
                    href={`https://www.youtube.com/watch?v=${trailer.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold flex items-center gap-2"
                  >
                    <Play size={16} /> Watch Trailer
                  </a>
                )}

                {/* Single Add to popup button (replaces Favorite + Watchlist buttons) */}
                <AddToPopup
                  isFavorite={isFavorite}
                  isWatchlist={isWatchlist}
                  onToggleFavorite={() => onToggleFavorite(item)}
                  onToggleWatchlist={() => onToggleWatchlist(item)}
                />

                {/* Stremio & Letterboxd (kept as-is but smaller) */}
                <a
                  href={stremioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg bg-[#1b2332]/90 hover:bg-[#252f3f] text-xs font-semibold text-slate-100 flex items-center gap-2 border border-cyan-500/20"
                >
                  <img src="/stremio-icon.png" alt="Stremio" className="w-4 h-4" />
                  Open in Stremio
                </a>

                <a
                  href={letterboxdUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg bg-[#202830]/80 hover:bg-[#2c3440] text-xs font-semibold text-slate-200 flex items-center gap-2 border border-white/6"
                >
                  <ExternalLink size={14} /> Letterboxd
                </a>
              </div>
            </div>

            {/* Collapsible rating row */}
            <div className="mt-3">
              {ratingCollapsed ? (
                <button
                  onClick={() => setRatingCollapsed(false)}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/60 border border-white/6 text-sm font-semibold"
                  aria-expanded={!ratingCollapsed}
                  title="Click to open rating"
                >
                  {/* Show compact numeric rating badge or placeholder */}
                  <span className="inline-flex items-center gap-1 bg-black/30 px-2 py-1 rounded-md">
                    <span className="text-sm font-bold">
                      {userMediaRating ? userMediaRating.toFixed(1) : '—'}
                    </span>
                    <Star size={14} className="text-yellow-400" />
                  </span>
                  <span className="text-xs text-slate-400">Your Rating</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-3">
                  <StarRating
                    value={userMediaRating}
                    onChange={(rating) => onRate(mediaKey, rating)}
                    size={22}
                  />
                  <button
                    onClick={() => setRatingCollapsed(true)}
                    className="text-xs text-slate-400 underline"
                  >
                    Collapse
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT — reduced paddings / smaller boxes */}
      <div className="max-w-7xl mx-auto px-4 pb-20 -mt-8 relative z-30">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (large) */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-[#0b1221]/80 backdrop-blur-xl border border-white/5 p-6 rounded-2xl">
              {item.tagline && <h3 className="text-lg italic text-cyan-200 mb-2">"{item.tagline}"</h3>}
              <p className="text-sm text-slate-300 leading-7">{item.overview}</p>
            </div>

            {/* Cast */}
            <section>
              <h3 className="text-xl font-bold text-white mb-4">Top Cast</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {cast.map((person) => (
                  <div
                    key={person.id}
                    onClick={() => onCastClick(person.id)}
                    className="group bg-[#0f172a] rounded-xl p-2 border border-white/5 hover:border-cyan-500/40 transition-all cursor-pointer flex items-center gap-3"
                  >
                    <img
                      src={
                        person.profile_path
                          ? `https://image.tmdb.org/t/p/w200${person.profile_path}`
                          : 'https://via.placeholder.com/200'
                      }
                      alt={person.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="overflow-hidden">
                      <p className="text-slate-200 font-semibold text-sm truncate">{person.name}</p>
                      <p className="text-xs text-slate-500 truncate">{person.character}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Crew */}
            {crew.length > 0 && (
              <section>
                <h3 className="text-xl font-bold text-white mb-4">Creative Team</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {crew.map((person) => (
                    <div
                      key={`crew-${person.id}-${person.job}`}
                      onClick={() => onCastClick(person.id)}
                      className="group bg-[#0f172a] rounded-xl p-2 border border-white/5 hover:border-purple-500/40 transition-all cursor-pointer"
                    >
                      <p className="text-slate-200 font-semibold text-sm truncate">{person.name}</p>
                      <p className="text-xs text-slate-500 truncate">{person.job}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews (kept leaner) */}
            {item.reviews?.results?.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xl font-bold text-white">TMDB Reviews</h3>
                <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                  {item.reviews.results.map((rev) => (
                    <div key={rev.id} className="p-3 rounded-xl bg-[#0f172a] border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-slate-100">{rev.author || rev.author_details?.username || 'User'}</span>
                        {typeof rev.author_details?.rating === 'number' && (
                          <span className="inline-flex items-center gap-1 text-sm text-amber-300">
                            <Star size={14} />
                            {rev.author_details.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 line-clamp-6">{rev.content}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Column */}
          <aside className="lg:col-span-1 space-y-6">
            {item.media_type === 'tv' && item.seasons && (
              <div className="bg-[#0b1221]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold">Seasons</h3>
                  <select
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                    className="bg-slate-900 text-sm text-white border border-slate-700 rounded-md py-1 pl-2 pr-6"
                  >
                    {item.seasons.filter((s) => s.season_number > 0).map((s) => (
                      <option key={s.id} value={s.season_number}>
                        Season {s.season_number} ({s.episode_count})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
                  {loadingEpisodes ? (
                    <div className="flex items-center justify-center h-24">
                      <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : episodes.length > 0 ? (
                    episodes.map((ep) => (
                      <button
                        key={ep.id}
                        onClick={() => onEpisodeClick && onEpisodeClick(item.id, ep.season_number, ep.episode_number)}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-white/3 transition flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm font-semibold">{ep.episode_number}. {ep.name}</div>
                          <div className="text-xs text-slate-400">{ep.air_date || ''}</div>
                        </div>
                        <div className="text-xs text-slate-400">{ep.vote_average ? ep.vote_average.toFixed(1) : '—'}</div>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No episodes loaded.</p>
                  )}
                </div>
              </div>
            )}

            {/* Quick stats box (smaller) */}
            <div className="bg-[#0b1221]/80 p-4 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-400">Runtime / Seasons</div>
                <div className="text-sm font-semibold">
                  {item.runtime ? `${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m` : item.number_of_seasons ? `${item.number_of_seasons} seasons` : '—'}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default DetailView;