export interface MediaItem {
  id: number;
  title?: string;
  name?: string; // TV shows use 'name'
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  air_date?: string;
  media_type: 'movie' | 'tv' | 'person';
  genre_ids?: number[];
  // For Episode Ranking
  season_number?: number;
  episode_number?: number;
  still_path?: string | null;
  // User rating
  userRating?: number;
}

export interface MediaDetail extends MediaItem {
  genres: { id: number; name: string }[];
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  tagline?: string;
  status: string;
  credits?: {
    cast: CastMember[];
    crew: CrewMember[];
  };
  videos?: {
    results: Video[];
  };
  seasons?: Season[];
  budget?: number;
  external_ids?: {
    imdb_id?: string;
    facebook_id?: string;
    instagram_id?: string;
    twitter_id?: string;
  };
  reviews?: {
    results: Review[];
    page: number;
    total_pages: number;
    total_results: number;
  };
}

export interface PersonDetail {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  imdb_id?: string;
  combined_credits: {
    cast: MediaItem[];
    crew: MediaItem[];
  };
}

export interface Season {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date: string;
  poster_path: string;
}

export interface ReviewAuthorDetails {
  name: string | null;
  username: string | null;
  avatar_path: string | null;
  rating: number | null;
}

export interface Review {
  id: string;
  author: string;
  author_details: ReviewAuthorDetails;
  content: string;
  created_at: string;
  url: string;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  vote_average: number;
  vote_count: number;
  air_date: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
  userRating?: number;
}

export interface EpisodeDetail extends Episode {
  credits?: any;
  external_ids?: any;
  videos?: {
    results: any[];
  };
  reviews?: {
    results: Review[];
    page: number;
    total_pages: number;
    total_results: number;
  };
  show_name?: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
}

export interface GeminiFilter {
  searchType: 'general' | 'episode_ranking' | 'person' | 'trending';
  media_type?: 'movie' | 'tv';
  query?: string; // For keyword search fallback or specific title search
  genres?: number[];
  year?: number;
  sort_by?: string;
  with_people?: string; // Simplified for logic, mapped to IDs later if needed
  language?: string;
  limit?: number;
  explanation?: string; // Short text explaining what AI did
}

export interface AppState {
  view: 'trending' | 'search' | 'detail' | 'library' | 'settings';
  selectedItem: MediaDetail | null;
  selectedPerson: PersonDetail | null;
  selectedEpisode: EpisodeDetail | null;
  isLoading: boolean;
  error: string | null;
  favorites: MediaItem[];
  watchlist: MediaItem[];
  aiExplanation: string | null;
  userRatings: { [key: string]: number }; // Map of media/episode IDs to user ratings
}