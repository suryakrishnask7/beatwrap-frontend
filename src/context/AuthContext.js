import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken, wakeBackend } from '../services/apiService';
import { getRuntimeConfig } from '../utils/runtimeConfig';

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext(null);

const { SPOTIFY_CLIENT_ID, BACKEND_URL } = getRuntimeConfig();
const IS_PRODUCTION = !__DEV__;
const REDIRECT_URI = IS_PRODUCTION
  ? 'com.beatwrap.app://redirect'
  : AuthSession.makeRedirectUri({ scheme: 'beatwrap' });

console.log('REDIRECT_URI:', REDIRECT_URI);
console.log('BACKEND_URL:', BACKEND_URL);
console.log('SPOTIFY_CLIENT_ID present:', Boolean(SPOTIFY_CLIENT_ID));

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const GUEST_USER = {
  _id: 'guest', displayName: 'Guest', email: null,
  username: 'guest', hasUsername: true, isGuest: true,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jwtToken, setJwtToken] = useState(null);
  const refreshTimerRef = useRef(null);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      scopes: ['user-top-read', 'user-read-recently-played', 'user-read-currently-playing', 'user-read-private', 'user-read-email'],
      usePKCE: true,
      redirectUri: REDIRECT_URI,
    },
    discovery
  );

  useEffect(() => {
    wakeBackend().catch(() => {});
    loadStoredAuth();
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      exchangeCodeForToken(response.params.code, request?.codeVerifier);
    } else if (response?.type === 'error' || response?.type === 'dismiss') {
      setLoading(false);
    }
  }, [response]);

  const scheduleRefresh = (secs) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => refreshSpotifyToken(), Math.max((secs - 300) * 1000, 10000));
  };

  const refreshSpotifyToken = async () => {
    try {
      const rt = await SecureStore.getItemAsync('spotify_refresh_token');
      if (!rt) { await doSignOut(); return; }
      const params = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: rt, client_id: SPOTIFY_CLIENT_ID });
      const res = await axios.post('https://accounts.spotify.com/api/token', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const { access_token, refresh_token, expires_in } = res.data;
      await SecureStore.setItemAsync('spotify_token', access_token);
      if (refresh_token) await SecureStore.setItemAsync('spotify_refresh_token', refresh_token);
      await SecureStore.setItemAsync('spotify_token_expiry', String(Date.now() + expires_in * 1000));
      setSpotifyToken(access_token);
      scheduleRefresh(expires_in);
    } catch (e) {
      console.error('Refresh failed:', e?.response?.data || e.message);
      await doSignOut();
    }
  };

  const loadStoredAuth = async () => {
    try {
      const guestMode = await AsyncStorage.getItem('guest_mode');
      if (guestMode === 'true') { setUser(GUEST_USER); setLoading(false); return; }

      const [storedToken, storedUser, storedJwt, storedExpiry, storedRt] = await Promise.all([
        SecureStore.getItemAsync('spotify_token'),
        SecureStore.getItemAsync('user_data'),
        SecureStore.getItemAsync('jwt_token'),
        SecureStore.getItemAsync('spotify_token_expiry'),
        SecureStore.getItemAsync('spotify_refresh_token'),
      ]);

      if (storedToken && storedUser) {
        const secsLeft = Math.floor((parseInt(storedExpiry || '0') - Date.now()) / 1000);
        if (storedJwt) setAuthToken(storedJwt);
        setUser(JSON.parse(storedUser));
        setJwtToken(storedJwt);
        if (secsLeft < 60) {
          setLoading(false);
          refreshSpotifyToken();
        } else {
          setSpotifyToken(storedToken);
          if (storedRt && secsLeft > 0) scheduleRefresh(secsLeft);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error('Load auth error:', e);
      setLoading(false);
    }
  };

  const exchangeCodeForToken = async (code, verifier) => {
    try {
      setLoading(true);
      const tokenRes = await AuthSession.exchangeCodeAsync(
        { clientId: SPOTIFY_CLIENT_ID, code, redirectUri: REDIRECT_URI, extraParams: { code_verifier: verifier } },
        discovery
      );
      const { accessToken, refreshToken, expiresIn = 3600 } = tokenRes;

      const profileRes = await axios.get('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const backendRes = await axios.post(`${BACKEND_URL}/api/auth/spotify`, {
        spotifyId: profileRes.data.id,
        displayName: profileRes.data.display_name,
        email: profileRes.data.email,
        profileImage: profileRes.data.images?.[0]?.url || null,
        spotifyToken: accessToken,
      });
      const { token: jwt, user: backendUser } = backendRes.data;

      await Promise.all([
        SecureStore.setItemAsync('spotify_token', accessToken),
        SecureStore.setItemAsync('user_data', JSON.stringify(backendUser)),
        SecureStore.setItemAsync('jwt_token', jwt),
        SecureStore.setItemAsync('spotify_token_expiry', String(Date.now() + expiresIn * 1000)),
        ...(refreshToken ? [SecureStore.setItemAsync('spotify_refresh_token', refreshToken)] : []),
      ]);

      setSpotifyToken(accessToken);
      setUser(backendUser); // if backendUser.hasUsername=false → App.js shows UsernameScreen
      setJwtToken(jwt);
      setAuthToken(jwt);
      scheduleRefresh(expiresIn);
    } catch (e) {
      console.error('Token exchange failed:', e?.response?.data || e.message);
    } finally {
      setLoading(false);
    }
  };

  const doSignOut = async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    await AsyncStorage.multiRemove(['guest_mode', 'weekly_wrap', 'friends_list', 'friend_requests']);
    try {
      await Promise.all([
        SecureStore.deleteItemAsync('spotify_token'),
        SecureStore.deleteItemAsync('spotify_refresh_token'),
        SecureStore.deleteItemAsync('spotify_token_expiry'),
        SecureStore.deleteItemAsync('user_data'),
        SecureStore.deleteItemAsync('jwt_token'),
      ]);
    } catch {}
    setAuthToken(null);
    setUser(null);
    setSpotifyToken(null);
    setJwtToken(null);
  };

  const enterGuestMode = async () => {
    await AsyncStorage.setItem('guest_mode', 'true');
    setUser(GUEST_USER);
  };

  // Called by UsernameScreen after successful username set
  const setUsername = async (updatedUser) => {
    const merged = { ...user, ...updatedUser };
    setUser(merged);
    await SecureStore.setItemAsync('user_data', JSON.stringify(merged));
  };

  return (
    <AuthContext.Provider value={{ user, spotifyToken, jwtToken, loading, signIn: () => promptAsync(), signOut: doSignOut, enterGuestMode, setUsername }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
