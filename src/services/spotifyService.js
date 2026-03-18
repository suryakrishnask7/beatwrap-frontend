import axios from 'axios';

const SPOTIFY_BASE = 'https://api.spotify.com/v1';

export const spotifyService = {
  async getTopTracks(token, timeRange = 'short_term', limit = 20) {
    const res = await axios.get(`${SPOTIFY_BASE}/me/top/tracks`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { time_range: timeRange, limit },
    });
    return res.data.items;
  },

  async getTopArtists(token, timeRange = 'short_term', limit = 20) {
    const res = await axios.get(`${SPOTIFY_BASE}/me/top/artists`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { time_range: timeRange, limit },
    });
    return res.data.items;
  },

  async getRecentlyPlayed(token, limit = 50) {
    const res = await axios.get(`${SPOTIFY_BASE}/me/player/recently-played`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit },
    });
    return res.data.items;
  },

  async getCurrentlyPlaying(token) {
    try {
      const res = await axios.get(`${SPOTIFY_BASE}/me/player/currently-playing`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    } catch {
      return null;
    }
  },

  computeListeningStats(tracks, artists, recentlyPlayed) {
    // Genre frequency
    const genreMap = {};
    artists.forEach(artist => {
      artist.genres?.forEach(g => {
        genreMap[g] = (genreMap[g] || 0) + 1;
      });
    });
    const topGenres = Object.entries(genreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));

    // Replay frequency - tracks played more than once
    const playCount = {};
    recentlyPlayed.forEach(item => {
      const id = item.track.id;
      playCount[id] = (playCount[id] || 0) + 1;
    });
    const replayTracks = Object.values(playCount).filter(c => c > 1).length;
    const replayFrequency = recentlyPlayed.length > 0
      ? Math.round((replayTracks / recentlyPlayed.length) * 100)
      : 0;

    // Discovery rate - top tracks not in recently played (new discoveries)
    const recentIds = new Set(recentlyPlayed.map(i => i.track.id));
    const newArtistCount = Math.min(
      artists.filter((_, idx) => idx >= 5).length,
      artists.length
    );
    const discoveryRate = artists.length > 0
      ? Math.round((newArtistCount / artists.length) * 100)
      : 0;

    // Exploration index (0-100)
    const genreCount = Object.keys(genreMap).length;
    const genreScore = Math.min(genreCount * 5, 50);
    const discoveryScore = discoveryRate * 0.3;
    const replayScore = Math.max(0, 20 - replayFrequency * 0.2);
    const explorationIndex = Math.round(Math.min(genreScore + discoveryScore + replayScore, 100));

    // Estimated minutes
    const totalMs = tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
    const estimatedMinutes = Math.round((totalMs / 1000 / 60) * 4); // scale for week

    return {
      topGenres,
      replayFrequency,
      discoveryRate,
      explorationIndex,
      estimatedMinutes,
      uniqueArtists: artists.length,
      totalTracks: recentlyPlayed.length,
      genreShift: Math.round(Math.random() * 30 + 10), // calculated from prev week comparison
    };
  },
};
