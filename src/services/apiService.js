import axios from 'axios';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.BACKEND_URL || 'https://beatwrap-backend.onrender.com';

const api = axios.create({ baseURL: BACKEND_URL });

// Retry once on network error
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
  // ── Profile stats (was missing — caused silent crash in ProfileScreen) ──
  getProfileStats: async () => {
    const res = await api.get('/api/auth/stats');
    return res.data; // { wraps, moodDays, friends }
  },

  // ── Wrap (Atlas storage) ──────────────────────────────────────────
  getWrapFromCloud: async (weekKey) => {
    const res = await api.get('/api/wrap/current', { params: { weekKey } });
    return res.data; // { found, wrap, stats, weekKey }
  },
  saveWrapToCloud: async (weekKey, aiWrap, stats) => {
    const res = await api.post('/api/wrap/save', { weekKey, aiWrap, stats });
    return res.data; // { saved, wrap, stats }
  },
  getWrapHistory: async (currentWeekKey) => {
    const res = await api.get('/api/wrap/history', { params: { currentWeekKey } });
    return res.data;
  },

  // ── Friends ──────────────────────────────────────────────────────
  getFriends: async (userId) => {
    const res = await api.get(`/api/friends/${userId}`);
    return res.data;
  },
  searchUsers: async (query) => {
    const res = await api.get('/api/friends/search', { params: { q: query } });
    return res.data; // { users: [] }
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
    return res.data; // { messages: [] }
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
    return res.data; // { moods: { 0: {...}, 1: {...} } }
  },
  getCompatibility: async (userId, friendId) => {
    const res = await api.get(`/api/friends/compatibility/${userId}/${friendId}`);
    return res.data;
  },
};