import axios from 'axios';
import { getRuntimeConfig } from '../utils/runtimeConfig';

const { BACKEND_URL } = getRuntimeConfig();

const api = axios.create({ baseURL: BACKEND_URL });

api.interceptors.response.use(
  res => res,
  async err => {
    if (!err.config._retry && (err.code === 'ECONNABORTED' || !err.response)) {
      err.config._retry = true;
      await new Promise(r => setTimeout(r, 1500));
      return api(err.config);
    }
    return Promise.reject(err);
  }
);

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const wakeBackend = async () => {
  const res = await api.get('/health');
  return res.data;
};

export const apiService = {
  // ── Auth ─────────────────────────────────────────────────────────
  checkUsername: async (username) => {
    const res = await api.get(`/api/auth/check-username/${username}`);
    return res.data;
  },
  setUsername: async (username) => {
    const res = await api.post('/api/auth/username', { username });
    return res.data;
  },
  getProfileStats: async () => {
    const res = await api.get('/api/auth/stats');
    return res.data;
  },

  // ── Wrap ──────────────────────────────────────────────────────────
  getWrapFromCloud: async (weekKey) => {
    const res = await api.get('/api/wrap/current', { params: { weekKey } });
    return res.data;
  },
  saveWrapToCloud: async (weekKey, aiWrap, stats) => {
    const res = await api.post('/api/wrap/save', { weekKey, aiWrap, stats });
    return res.data;
  },
  getWrapHistory: async (currentWeekKey) => {
    const res = await api.get('/api/wrap/history', { params: { currentWeekKey } });
    return res.data;
  },

  // NEW: regenerate character — backend enforces 24h cooldown
  // Returns: { success, tamil_character, tamil_protagonist } on success
  // Returns: { error: 'cooldown', message, hoursLeft } on 429
  regenerateCharacter: async (weekKey) => {
    const res = await api.post('/api/wrap/regenerate-character', { weekKey });
    return res.data;
  },

  // ── Friends ──────────────────────────────────────────────────────
  getFriends: async (userId) => {
    const res = await api.get(`/api/friends/${userId}`);
    return res.data;
  },
  searchUsers: async (query) => {
    const res = await api.get('/api/friends/search', { params: { q: query } });
    return res.data;
  },
  sendFriendRequest: async (fromId, toId) => {
    const res = await api.post('/api/friends/request', { fromId, toId });
    return res.data;
  },
  sendFriendRequestByEmail: async (fromId, email) => {
    const res = await api.post('/api/friends/request/email', { fromId, email });
    return res.data;
  },
  getPendingRequests: async (userId) => {
    const res = await api.get(`/api/friends/requests/pending/${userId}`);
    return res.data;
  },
  acceptFriendRequest: async (requestId) => {
    const res = await api.put(`/api/friends/request/${requestId}/accept`);
    return res.data;
  },
  unfriend: async (userId, friendId) => {
    const res = await api.delete(`/api/friends/${friendId}`);
    return res.data;
  },

  // ── Messages ─────────────────────────────────────────────────────
  getMessages: async (friendId) => {
    const res = await api.get(`/api/messages/${friendId}`);
    return res.data;
  },
  getConversations: async () => {
    const res = await api.get('/api/messages');
    return res.data;
  },

  // ── Mood ──────────────────────────────────────────────────────────
  saveMood: async (weekKey, dayIndex, day, emoji, label, value, note) => {
    const res = await api.post('/api/mood/save', { weekKey, dayIndex, day, emoji, label, value, note });
    return res.data;
  },
  getWeekMoods: async (weekKey) => {
    const res = await api.get('/api/mood/week', { params: { weekKey } });
    return res.data;
  },
  syncListeningHistory: async (weekKey, topTracks, topArtists, topGenres, stats) => {
    const res = await api.post('/api/listening/sync', { weekKey, topTracks, topArtists, topGenres, stats });
    return res.data;
  },
  getCompatibility: async (userId, friendId) => {
    const res = await api.get(`/api/friends/compatibility/${userId}/${friendId}`);
    return res.data;
  },
};
