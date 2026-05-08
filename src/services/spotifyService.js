import axios from 'axios';

const SPOTIFY_BASE = 'https://api.spotify.com/v1';

const spotifyApi = axios.create({
  baseURL: SPOTIFY_BASE,
});

let isRateLimited = false;
let requestQueue = [];

spotifyApi.interceptors.request.use(async (config) => {
  if (isRateLimited) {
    await new Promise(resolve => requestQueue.push(resolve));
  }
  return config;
});

spotifyApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response && error.response.status === 429 && !originalRequest._isRetry) {
      originalRequest._isRetry = true;
      
      if (!isRateLimited) {
        isRateLimited = true;
        const retryAfter = error.response.headers['retry-after'] 
          ? parseInt(error.response.headers['retry-after'], 10) * 1000 
          : 5000; // default 5 seconds if header missing
        
        console.warn(`[Spotify API] 429 Rate Limit. Pausing all requests for ${retryAfter}ms`);
        setTimeout(() => {
          isRateLimited = false;
          requestQueue.forEach(resolve => resolve());
          requestQueue = [];
        }, retryAfter);
      }
      
      // Wait in the queue to retry the failed request
      return new Promise((resolve) => {
        requestQueue.push(() => resolve(spotifyApi(originalRequest)));
      });
    }
    return Promise.reject(error);
  }
);

export const spotifyService = {
  async getTopTracks(token, timeRange = 'short_term', limit = 20) {
    const res = await spotifyApi.get('/me/top/tracks', {
      headers: { Authorization: `Bearer ${token}` },
      params: { time_range: timeRange, limit },
    });
    return res.data.items;
  },

  async getTopArtists(token, timeRange = 'short_term', limit = 20) {
    const res = await spotifyApi.get('/me/top/artists', {
      headers: { Authorization: `Bearer ${token}` },
      params: { time_range: timeRange, limit },
    });
    return res.data.items;
  },

  async getRecentlyPlayed(token, limit = 50) {
    const res = await spotifyApi.get('/me/player/recently-played', {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit },
    });
    return res.data.items;
  },

  async getCurrentlyPlaying(token) {
    try {
      const res = await spotifyApi.get('/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    } catch { return null; }
  },

  // ── Process a list of recently-played items into structured per-day data ─────
  // Used by both full sync and incremental sync so logic stays in one place.
  processPlayItems(items, sinceTimestampMs = 0) {
    const dailyMinutesMs = {}; // accumulate in ms, convert at end
    const dailyPlays     = {}; // date → { trackId: { ...track, plays } }
    const trackPlayCounts = {};
    let totalMs = 0;
    let newestTs = sinceTimestampMs;

    for (const item of items) {
      const playedAt = new Date(item.played_at).getTime();
      if (playedAt <= sinceTimestampMs) continue;

      const track = item.track;
      if (!track?.id) continue;

      const trackId   = track.id;
      const durationMs = track.duration_ms || 0;
      const date      = new Date(item.played_at).toISOString().split('T')[0]; // "YYYY-MM-DD"

      totalMs += durationMs;

      // Daily minutes (ms for now)
      dailyMinutesMs[date] = (dailyMinutesMs[date] || 0) + durationMs;

      // Daily play tracking (for top 5)
      if (!dailyPlays[date]) dailyPlays[date] = {};
      if (!dailyPlays[date][trackId]) {
        dailyPlays[date][trackId] = {
          trackId,
          name:     track.name,
          artist:   track.artists?.[0]?.name || '',
          artistId: track.artists?.[0]?.id   || '',
          albumImg: track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || null,
          plays:    0,
        };
      }
      dailyPlays[date][trackId].plays++;

      // Global play counts this week
      trackPlayCounts[trackId] = (trackPlayCounts[trackId] || 0) + 1;

      if (playedAt > newestTs) newestTs = playedAt;
    }

    // Convert ms → minutes
    const dailyMinutes = {};
    Object.entries(dailyMinutesMs).forEach(([date, ms]) => {
      dailyMinutes[date] = Math.round(ms / 60000);
    });

    // Top 5 per day by play count
    const dailyTopTracks = {};
    Object.entries(dailyPlays).forEach(([date, tracks]) => {
      dailyTopTracks[date] = Object.values(tracks)
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 5);
    });

    return {
      totalMinutes: Math.round(totalMs / 60000),
      dailyMinutes,
      dailyTopTracks,
      trackPlayCounts,
      newestPlayedAt: newestTs > sinceTimestampMs ? newestTs : null,
    };
  },

  // ── Get all plays AFTER a timestamp using cursor-based pagination ────────────
  // Handles "2 days offline" case: 10 pages × 50 = 500 plays (~25hrs non-stop).
  // Uses ?after for first page, then ?before cursor for subsequent pages.
  async getIncrementalPlays(token, sinceTimestampMs, maxPages = 10) {
    const allItems = [];
    let cursor = null;
    let keepGoing = true;

    for (let page = 0; page < maxPages && keepGoing; page++) {
      try {
        const params = { limit: 50 };

        if (page === 0) {
          params.after = sinceTimestampMs; // first page: most recent plays after sinceTs
        } else if (cursor) {
          params.before = cursor;          // subsequent: page backwards into older plays
        } else {
          break;
        }

        const res = await spotifyApi.get('/me/player/recently-played', {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });

        const items = res.data.items || [];
        if (items.length === 0) break;

        for (const item of items) {
          const playedAt = new Date(item.played_at).getTime();
          if (playedAt <= sinceTimestampMs) { keepGoing = false; break; }
          allItems.push(item);
        }

        cursor = res.data.cursors?.before;
        if (!cursor) keepGoing = false;
      } catch (e) {
        console.warn('[getIncrementalPlays] page error:', e?.message);
        break;
      }
    }

    return allItems;
  },

  // ── Full week data — paginate backwards from now to Monday ──────────────────
  // Returns all plays + processed per-day stats. Used on fresh load / rollover.
  async getWeekData(token) {
    const now    = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const mondayTs = monday.getTime();

    const allItems = [];
    let cursor     = null;
    let keepGoing  = true;
    let pageCount  = 0;

    while (keepGoing && pageCount < 20) {
      try {
        const params = { limit: 50 };
        if (cursor) params.before = cursor;

        const res = await spotifyApi.get('/me/player/recently-played', {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });

        const items = res.data.items || [];
        if (items.length === 0) break;

        for (const item of items) {
          if (new Date(item.played_at).getTime() < mondayTs) { keepGoing = false; break; }
          allItems.push(item);
        }

        cursor = res.data.cursors?.before;
        if (!cursor) keepGoing = false;
        pageCount++;
      } catch (e) {
        console.warn('[getWeekData] error:', e?.message);
        break;
      }
    }

    console.log(`[getWeekData] pages=${pageCount} plays=${allItems.length}`);
    return this.processPlayItems(allItems, mondayTs - 1);
  },

  // Backward-compat alias (used by StatsScreen polling)
  async getWeekMinutes(token) {
    const data = await this.getWeekData(token);
    return data.totalMinutes;
  },

  computeListeningStats(tracks, artists, recentlyPlayed) {
    const genreMap = {};
    artists.forEach(artist => {
      artist.genres?.forEach(g => { genreMap[g] = (genreMap[g] || 0) + 1; });
    });
    const topGenres = Object.entries(genreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));

    const playCount = {};
    recentlyPlayed.forEach(item => {
      const id = item.track.id;
      playCount[id] = (playCount[id] || 0) + 1;
    });
    const replayTracks = Object.values(playCount).filter(c => c > 1).length;
    const replayFrequency = recentlyPlayed.length > 0
      ? Math.round((replayTracks / recentlyPlayed.length) * 100) : 0;

    const newArtistCount = Math.min(artists.filter((_, idx) => idx >= 5).length, artists.length);
    const discoveryRate = artists.length > 0
      ? Math.round((newArtistCount / artists.length) * 100) : 0;

    const genreCount    = Object.keys(genreMap).length;
    const genreScore    = Math.min(genreCount * 5, 50);
    const discoveryScore = discoveryRate * 0.3;
    const replayScore   = Math.max(0, 20 - replayFrequency * 0.2);
    const explorationIndex = Math.round(Math.min(genreScore + discoveryScore + replayScore, 100));

    return {
      topGenres, replayFrequency, discoveryRate, explorationIndex,
      estimatedMinutes: 0, // replaced by getWeekData().totalMinutes
      uniqueArtists: artists.length,
      totalTracks: recentlyPlayed.length,
      genreShift: Math.round(Math.random() * 30 + 10),
    };
  },
};