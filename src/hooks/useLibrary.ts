// src/hooks/useLibrary.ts
import { MediaItem, AppState } from '../types';

interface UseLibraryProps {
  favorites: MediaItem[];
  watchlist: MediaItem[];
  userRatings: { [key: string]: number };
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

/**
 * Hook for library management (favorites, watchlist, ratings).
 * This hook does NOT hold state - it receives state from App and provides helper functions.
 * App.tsx remains the single source of truth for library data.
 */
export function useLibrary({ favorites, watchlist, userRatings, setState }: UseLibraryProps) {
  const toggleFavorite = (item: MediaItem) => {
    setState((prev) => {
      const exists = prev.favorites.find((i) => i.id === item.id);
      const newFavorites = exists
        ? prev.favorites.filter((i) => i.id !== item.id)
        : [...prev.favorites, item];
      return { ...prev, favorites: newFavorites };
    });
  };

  const toggleWatchlist = (item: MediaItem) => {
    setState((prev) => {
      const exists = prev.watchlist.find((i) => i.id === item.id);
      const newWatchlist = exists
        ? prev.watchlist.filter((i) => i.id !== item.id)
        : [...prev.watchlist, item];
      return { ...prev, watchlist: newWatchlist };
    });
  };

  const rateItem = (itemId: string, rating: number) => {
    setState((prev) => ({
      ...prev,
      userRatings: {
        ...prev.userRatings,
        [itemId]: rating,
      },
    }));
  };

  return {
    toggleFavorite,
    toggleWatchlist,
    rateItem,
  };
}
