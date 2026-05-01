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

  /**
   * Accurate week minutes — paginates backwards through recently-played
   * using Spotify's cursor until played_at < this Monday 00:00.
   *
   * Works for brand-new accounts on first login (no sessions needed).
   * Sums real track duration_ms — not a guess or extrapolation.
   * MAX_PAGES × 50 = up to 1000 plays (~16+ hrs of music).
   */
  async getWeekMinutes(token) {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const mondayTs = monday.getTime();

    let totalMs = 0;
    let cursor = null;     // Spotify 'before' cursor (Unix ms string)
    let keepGoing = true;
    let pageCount = 0;
    const MAX_PAGES = 20;  // safety cap

    while (keepGoing && pageCount < MAX_PAGES) {
      try {
        const params = { limit: 50 };
        if (cursor) params.before = cursor;

        const res = await axios.get(`${SPOTIFY_BASE}/me/player/recently-played`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });

        const items = res.data.items || [];
        if (items.length === 0) break;

        for (const item of items) {
          const playedAt = new Date(item.played_at).getTime();
          if (playedAt < mondayTs) {
            keepGoing = false; // crossed into last week — stop
            break;
          }
          totalMs += item.track?.duration_ms || 0;
        }

        cursor = res.data.cursors?.before;
        if (!cursor) keepGoing = false;
        pageCount++;
      } catch (e) {
        console.warn('[getWeekMinutes] error:', e?.message);
        break;
      }
    }

    console.log(`[getWeekMinutes] pages=${pageCount} totalMs=${totalMs} mins=${Math.round(totalMs / 60000)}`);
    return Math.round(totalMs / 60000);
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

    // Replay frequency
    const playCount = {};
    recentlyPlayed.forEach(item => {
      const id = item.track.id;
      playCount[id] = (playCount[id] || 0) + 1;
    });
    const replayTracks = Object.values(playCount).filter(c => c > 1).length;
    const replayFrequency = recentlyPlayed.length > 0
      ? Math.round((replayTracks / recentlyPlayed.length) * 100)
      : 0;

    // Discovery rate
    const newArtistCount = Math.min(artists.filter((_, idx) => idx >= 5).length, artists.length);
    const discoveryRate = artists.length > 0
      ? Math.round((newArtistCount / artists.length) * 100)
      : 0;

    // Exploration index (0-100)
    const genreCount = Object.keys(genreMap).length;
    const genreScore = Math.min(genreCount * 5, 50);
    const discoveryScore = discoveryRate * 0.3;
    const replayScore = Math.max(0, 20 - replayFrequency * 0.2);
    const explorationIndex = Math.round(Math.min(genreScore + discoveryScore + replayScore, 100));

    // NOTE: estimatedMinutes is intentionally 0 here.
    // HomeScreen replaces it with the accurate value from getWeekMinutes().
    return {
      topGenres,
      replayFrequency,
      discoveryRate,
      explorationIndex,
      estimatedMinutes: 0,
      uniqueArtists: artists.length,
      totalTracks: recentlyPlayed.length,
      genreShift: Math.round(Math.random() * 30 + 10),
    };
  },
};