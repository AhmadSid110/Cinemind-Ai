// Utility functions for the app

/**
 * Generates a unique key for an episode rating
 * @param mediaId - The TMDB ID of the TV show
 * @param seasonNumber - The season number
 * @param episodeNumber - The episode number
 * @returns A unique string key in format: tv-{mediaId}-s{season}e{episode}
 */
export const generateEpisodeKey = (
  mediaId: number,
  seasonNumber: number,
  episodeNumber: number
): string => {
  return `tv-${mediaId}-s${seasonNumber}e${episodeNumber}`;
};

/**
 * Generates a unique key for a media item rating (movie or TV show)
 * @param mediaType - Either 'movie' or 'tv'
 * @param mediaId - The TMDB ID of the media item
 * @returns A unique string key in format: {mediaType}-{mediaId}
 */
export const generateMediaKey = (
  mediaType: 'movie' | 'tv',
  mediaId: number
): string => {
  return `${mediaType}-${mediaId}`;
};
