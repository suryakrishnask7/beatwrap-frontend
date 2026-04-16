import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, RefreshControl, ActivityIndicator, Dimensions, Image, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../context/AuthContext';
import { spotifyService } from '../services/spotifyService';
import { groqService } from '../services/groqService';
import { COLORS, FONTS, SPACING } from '../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/apiService';

const { width } = Dimensions.get('window');

const getCurrentWeekKey = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};

const GUEST_WRAP = {
  week_label: 'The Phantom Listener',
  dominant_vibe: 'Late Night Cinematic',
  energy_level: 'Medium',
  confidence: 0.85,
  story: 'This week you drifted through sounds like a silhouette in a slow-motion scene. The frequencies were yours alone — no algorithm could predict them.',
  tamil_character: { name: 'Vikram (Pithamagan)', film: 'Pithamagan', why_this_character: 'A presence that speaks volumes through silence.' },
  tamil_protagonist: { archetype: 'The Silent Wanderer', inspired_by: 'Pithamagan' },
};

const GUEST_STATS = {
  topGenres: [
    { genre: 'indie soul', count: 18 }, { genre: 'cinematic', count: 14 },
    { genre: 'dark ambient', count: 11 }, { genre: 'lo-fi hip hop', count: 8 },
    { genre: 'alternative r&b', count: 6 },
  ],
  topTracks: [
    { id: '1', name: 'Guest Mode Active', artists: [{ name: 'Sign in to see your tracks' }], album: { images: [] }, duration_ms: 214000 },
    { id: '2', name: 'Your Top Track', artists: [{ name: 'Connect Spotify to unlock' }], album: { images: [] }, duration_ms: 187000 },
    { id: '3', name: "This Week's Anthem", artists: [{ name: 'BeatWrap Demo' }], album: { images: [] }, duration_ms: 203000 },
  ],
  topArtists: [
    { id: '1', name: 'Your Artists', genres: ['sign in to see'], images: [] },
    { id: '2', name: 'Appear Here', genres: ['spotify required'], images: [] },
    { id: '3', name: 'Demo Mode', genres: ['guest preview'], images: [] },
  ],
  estimatedMinutes: 0,
};

export default function HomeScreen({ navigation }) {
  const { user, spotifyToken, signOut, loading: authLoading } = useAuth();
  const [wrap, setWrap] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const didLoad = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (didLoad.current) return;
    didLoad.current = true;
    loadData();
  }, [authLoading]);

  const loadData = async () => {
    try {
      setLoading(true);
      const guestMode = await AsyncStorage.getItem('guest_mode');
      if (guestMode === 'true') {
        setIsGuest(true);
        setWrap(GUEST_WRAP);
        setStats(GUEST_STATS);
        return;
      }
      const cached = await AsyncStorage.getItem('weekly_wrap');
      if (cached) {
        const data = JSON.parse(cached);
        if (data.weekKey === getCurrentWeekKey()) {
          setWrap(data.wrap);
          setStats(data.stats);
          fetchStatsOnly();
          return;
        } else {
          // New week — archive previous week before fetching fresh
          await AsyncStorage.setItem('prev_weekly_wrap', cached);
        }
      }
      await fetchFreshData();
    } catch (e) {
      console.error('Load error:', e);
      setWrap(GUEST_WRAP);
      setStats(GUEST_STATS);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }
  };

  const fetchStatsOnly = async () => {
    try {
      if (!spotifyToken) return;
      const [tracks, artists, recent] = await Promise.all([
        spotifyService.getTopTracks(spotifyToken, 'short_term', 20),
        spotifyService.getTopArtists(spotifyToken, 'short_term', 20),
        spotifyService.getRecentlyPlayed(spotifyToken, 50),
      ]);
      const computedStats = spotifyService.computeListeningStats(tracks, artists, recent);
      computedStats.topTracks = tracks;
      computedStats.topArtists = artists;
      setStats(computedStats);
      const cached = await AsyncStorage.getItem('weekly_wrap');
      if (cached) {
        const data = JSON.parse(cached);
        await AsyncStorage.setItem('weekly_wrap', JSON.stringify({ ...data, stats: computedStats }));
      }
    } catch (e) {
      console.error('Stats refresh error:', e);
    }
  };

  const fetchFreshData = async () => {
    try {
      if (!spotifyToken) {
        setWrap(GUEST_WRAP);
        setStats(GUEST_STATS);
        return;
      }
      const currentWeekKey = getCurrentWeekKey();
      try {
        const cloudData = await apiService.getWrapFromCloud(currentWeekKey);
        if (cloudData.found) {
          setWrap(cloudData.wrap);
          setStats(cloudData.stats);
          await AsyncStorage.setItem('weekly_wrap', JSON.stringify({ wrap: cloudData.wrap, stats: cloudData.stats, weekKey: currentWeekKey }));
          return;
        }
      } catch (cloudErr) {
        console.log('Cloud check failed, generating fresh:', cloudErr?.message);
      }

      const [tracks, artists, recent] = await Promise.all([
        spotifyService.getTopTracks(spotifyToken, 'short_term', 20),
        spotifyService.getTopArtists(spotifyToken, 'short_term', 20),
        spotifyService.getRecentlyPlayed(spotifyToken, 50),
      ]);
      const computedStats = spotifyService.computeListeningStats(tracks, artists, recent);
      computedStats.topTracks = tracks;
      computedStats.topArtists = artists;

      apiService.syncListeningHistory(currentWeekKey, tracks, artists, computedStats.topGenres, computedStats).catch(() => {});
      await AsyncStorage.setItem('my_top_tracks', JSON.stringify(tracks));

      const storedMoods = await AsyncStorage.getItem('mood_logs');
      const moodLogsRaw = storedMoods ? JSON.parse(storedMoods) : {};
      const DAYS_LIST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      let moods = [];
      if (Array.isArray(moodLogsRaw)) {
        moods = moodLogsRaw.filter(Boolean);
      } else if (moodLogsRaw && typeof moodLogsRaw === 'object') {
        moods = Object.entries(moodLogsRaw)
          .map(([idx, log]) => log ? ({ day: DAYS_LIST[parseInt(idx)] || idx, ...log }) : null)
          .filter(Boolean);
      }

      const aiWrap = await groqService.generateWeeklyWrap(computedStats, moods);
      setStats(computedStats);
      setWrap(aiWrap);
      await AsyncStorage.setItem('weekly_wrap', JSON.stringify({ wrap: aiWrap, stats: computedStats, weekKey: currentWeekKey }));

      try {
        const saved = await apiService.saveWrapToCloud(currentWeekKey, aiWrap, computedStats);
        if (saved.saved === false && saved.wrap) {
          setWrap(saved.wrap);
          setStats(saved.stats);
          await AsyncStorage.setItem('weekly_wrap', JSON.stringify({ wrap: saved.wrap, stats: saved.stats, weekKey: currentWeekKey }));
        }
      } catch (saveErr) {
        console.log('Cloud save failed (offline?):', saveErr?.message);
      }
    } catch (e) {
      if (e?.response?.status === 401 || e?.status === 401) {
        await AsyncStorage.clear();
        await SecureStore.deleteItemAsync('spotify_token');
        await SecureStore.deleteItemAsync('user_data');
        await SecureStore.deleteItemAsync('jwt_token');
        signOut();
        return;
      }
      console.error('Fetch error:', e?.message);
      setWrap(GUEST_WRAP);
      setStats(GUEST_STATS);
    }
  };

  // ── Regenerate character — backend enforces 24h cooldown ─────────────────
  const regenerateCharacter = async () => {
    if (!wrap || isGuest) return;
    setRegenLoading(true);
    try {
      const currentWeekKey = getCurrentWeekKey();
      const result = await apiService.regenerateCharacter(currentWeekKey);

      const updatedWrap = {
        ...wrap,
        tamil_character: result.tamil_character,
        tamil_protagonist: result.tamil_protagonist,
      };
      setWrap(updatedWrap);

      const cached = await AsyncStorage.getItem('weekly_wrap');
      if (cached) {
        const data = JSON.parse(cached);
        await AsyncStorage.setItem('weekly_wrap', JSON.stringify({ ...data, wrap: updatedWrap }));
      }
    } catch (e) {
      if (e?.response?.status === 429) {
        const data = e.response.data;
        Alert.alert(
          'Come back tomorrow 🎭',
          data.message || 'You can regenerate your character once per day.',
          [{ text: 'Got it' }]
        );
      } else {
        Alert.alert('Error', 'Could not regenerate character. Try again.');
        console.error('Regen error:', e?.response?.data || e.message);
      }
    } finally {
      setRegenLoading(false);
    }
  };

  const onRefresh = async () => {
    if (isGuest) return;
    setRefreshing(true);
    await fetchStatsOnly();
    setRefreshing(false);
  };

  const getWeekLabel = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1);
    return `${start.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
  };

  const formatMinutes = (mins) => mins ? `${mins.toLocaleString()} min` : '0 min';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0A0A0F', '#12121E']} style={StyleSheet.absoluteFillObject} />
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Generating your wrap...</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {isGuest && (
        <View style={styles.guestBanner}>
          <Text style={styles.guestBannerText}>👀 Guest Preview — </Text>
          <TouchableOpacity onPress={async () => { await AsyncStorage.removeItem('guest_mode'); signOut(); }}>
            <Text style={styles.guestBannerLink}>Sign in with Spotify →</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        contentContainerStyle={[styles.scrollContent, isGuest && { paddingTop: 96 }]}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hey, {isGuest ? 'Guest' : (user?.displayName?.split(' ')[0] || 'listener')} 👋</Text>
            <Text style={styles.weekLabel}>{getWeekLabel()}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.profileBtn}>
            {user?.profileImage
              ? <Image source={{ uri: user.profileImage }} style={styles.profileBtnImage} />
              : <Text style={styles.profileBtnText}>{user?.displayName?.[0]?.toUpperCase() || '👤'}</Text>}
          </TouchableOpacity>
        </View>

        {/* ── Total Minutes Listened ── */}
        {stats?.estimatedMinutes > 0 && (
          <View style={styles.minutesCard}>
            <Text style={styles.minutesIcon}>⏱</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.minutesLabel}>TOTAL MINUTES LISTENED</Text>
              <Text style={styles.minutesValue}>{formatMinutes(stats.estimatedMinutes)}</Text>
            </View>
          </View>
        )}

        {/* Hero wrap card */}
        {wrap && (
          <View style={styles.heroCard}>
            <LinearGradient colors={['#1A0A1E', '#0D0D22', '#12121E']} style={styles.heroGradient}>
              <View style={styles.heroTop}>
                <View style={styles.weekBadge}>
                  <Text style={styles.weekBadgeText}>{isGuest ? 'DEMO WRAP' : "THIS WEEK'S WRAP"}</Text>
                </View>
                <Text style={styles.confidenceBadge}>{Math.round((wrap.confidence || 0.8) * 100)}% vibe match</Text>
              </View>
              <Text style={styles.weekLabelHero}>{wrap.week_label}</Text>
              <Text style={styles.dominantVibe}>{wrap.dominant_vibe}</Text>
              <View style={styles.energyRow}>
                <View style={styles.energyPill}>
                  <Text style={styles.energyPillText}>⚡ {wrap.energy_level}</Text>
                </View>
              </View>
              <Text style={styles.story}>{wrap.story}</Text>

              {wrap.tamil_character && (
                <View style={styles.characterCard}>
                  <LinearGradient colors={['#2A1025', '#1A0A1E']} style={styles.characterGradient}>
                    <Text style={styles.characterLabel}>CHARACTER OF THE WEEK</Text>
                    <Text style={styles.characterName}>{wrap.tamil_character.name}</Text>
                    <Text style={styles.characterFilm}>from {wrap.tamil_character.film}</Text>
                    <Text style={styles.characterWhy}>{wrap.tamil_character.why_this_character}</Text>
                  </LinearGradient>
                </View>
              )}

              {wrap.tamil_protagonist && (
                <View style={styles.archetypeRow}>
                  <Text style={styles.archetypeLabel}>Your archetype:</Text>
                  <Text style={styles.archetypeValue}>{wrap.tamil_protagonist.archetype}</Text>
                  {wrap.tamil_protagonist.inspired_by && (
                    <Text style={styles.archetypeInspired}>inspired by {wrap.tamil_protagonist.inspired_by}</Text>
                  )}
                </View>
              )}

              {/* Regenerate Character — backend-enforced 24h cooldown */}
              {!isGuest && (
                <TouchableOpacity style={styles.regenBtn} onPress={regenerateCharacter} disabled={regenLoading} activeOpacity={0.75}>
                  {regenLoading
                    ? <ActivityIndicator size="small" color={COLORS.violet} />
                    : <Text style={styles.regenBtnText}>🎭 Regenerate Character</Text>}
                </TouchableOpacity>
              )}
            </LinearGradient>
          </View>
        )}

        {/* Top Genres */}
        {stats?.topGenres?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Genre Spread</Text>
            <View style={styles.genreList}>
              {stats.topGenres.map((g, i) => (
                <View key={i} style={styles.genreRow}>
                  <Text style={styles.genreRank}>#{i + 1}</Text>
                  <View style={styles.genreBarContainer}>
                    <Text style={styles.genreName} numberOfLines={1}>{g.genre}</Text>
                    <View style={styles.genreBarBg}>
                      <View style={[styles.genreBar, {
                        width: `${Math.max(20, (g.count / stats.topGenres[0].count) * 100)}%`,
                        backgroundColor: [COLORS.accent, COLORS.violet, COLORS.cyan, COLORS.gold, COLORS.green][i % 5],
                      }]} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Top Tracks */}
        {stats?.topTracks?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Tracks This Week</Text>
            {stats.topTracks.slice(0, 5).map((track, i) => <TrackRow key={track.id} track={track} rank={i + 1} />)}
          </View>
        )}

        {/* Top Artists */}
        {stats?.topArtists?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Artists</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.artistScroll}>
              {stats.topArtists.slice(0, 8).map((artist, i) => <ArtistChip key={artist.id} artist={artist} rank={i + 1} />)}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </Animated.View>
  );
}

function TrackRow({ track, rank }) {
  const imageUrl = track.album?.images?.[2]?.url || track.album?.images?.[0]?.url;
  return (
    <View style={styles.trackRow}>
      <Text style={styles.trackRank}>#{rank}</Text>
      {imageUrl
        ? <Image source={{ uri: imageUrl }} style={styles.trackImage} />
        : <View style={[styles.trackImage, styles.trackImageFallback]}><Text style={{ fontSize: 14 }}>🎵</Text></View>}
      <View style={styles.trackInfo}>
        <Text style={styles.trackName} numberOfLines={1}>{track.name}</Text>
        <Text style={styles.trackArtist} numberOfLines={1}>{track.artists?.[0]?.name}</Text>
      </View>
      <Text style={styles.trackDuration}>
        {Math.floor((track.duration_ms || 0) / 60000)}:{String(Math.floor(((track.duration_ms || 0) % 60000) / 1000)).padStart(2, '0')}
      </Text>
    </View>
  );
}

function ArtistChip({ artist, rank }) {
  const colors = [COLORS.accent, COLORS.violet, COLORS.cyan, COLORS.gold, COLORS.green];
  const color = colors[rank % colors.length];
  const imageUrl = artist.images?.[1]?.url || artist.images?.[0]?.url;
  return (
    <View style={[styles.artistChip, { borderColor: color + '55' }]}>
      {imageUrl
        ? <Image source={{ uri: imageUrl }} style={styles.artistImage} />
        : <View style={[styles.artistImage, { backgroundColor: color + '33', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={[styles.artistAvatarText, { color }]}>{artist.name[0]}</Text>
          </View>}
      <Text style={styles.artistChipName} numberOfLines={1}>{artist.name}</Text>
      {artist.genres?.[0] && <Text style={styles.artistGenre} numberOfLines={1}>{artist.genres[0]}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  loadingText: { color: COLORS.textMuted, marginTop: SPACING.md, fontSize: FONTS.sizes.sm },
  scrollContent: { paddingTop: 60, paddingHorizontal: SPACING.md },
  guestBanner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: COLORS.gold + '22', borderBottomWidth: 1, borderBottomColor: COLORS.gold + '55',
    paddingTop: 52, paddingBottom: 10, paddingHorizontal: SPACING.md, flexDirection: 'row', alignItems: 'center',
  },
  guestBannerText: { color: COLORS.gold, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
  guestBannerLink: { color: COLORS.accent, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold, textDecorationLine: 'underline' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  greeting: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.text },
  weekLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  profileBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  profileBtnImage: { width: 44, height: 44, borderRadius: 22 },
  profileBtnText: { fontSize: 18, color: COLORS.textMuted, fontWeight: FONTS.weights.bold },
  minutesCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.bgCard, borderRadius: 14, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.cyan + '44', marginBottom: SPACING.md,
  },
  minutesIcon: { fontSize: 28 },
  minutesLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: FONTS.weights.bold, letterSpacing: 2, marginBottom: 3 },
  minutesValue: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.black, color: COLORS.cyan },
  heroCard: { borderRadius: 20, overflow: 'hidden', marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  heroGradient: { padding: SPACING.lg },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  weekBadge: { backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: COLORS.accent + '66', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  weekBadgeText: { color: COLORS.accent, fontSize: 9, fontWeight: FONTS.weights.bold, letterSpacing: 1.5 },
  confidenceBadge: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs },
  weekLabelHero: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.black, color: COLORS.text, letterSpacing: -0.5, marginBottom: 4 },
  dominantVibe: { fontSize: FONTS.sizes.md, color: COLORS.accent, fontWeight: FONTS.weights.medium, marginBottom: SPACING.sm },
  energyRow: { flexDirection: 'row', marginBottom: SPACING.md },
  energyPill: { backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  energyPillText: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs },
  story: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, lineHeight: 22, marginBottom: SPACING.md },
  characterCard: { borderRadius: 14, overflow: 'hidden', marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.accent + '33' },
  characterGradient: { padding: SPACING.md },
  characterLabel: { fontSize: 9, color: COLORS.accent, fontWeight: FONTS.weights.bold, letterSpacing: 2, marginBottom: 6 },
  characterName: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.black, color: COLORS.text, marginBottom: 2 },
  characterFilm: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: SPACING.sm },
  characterWhy: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, lineHeight: 20, fontStyle: 'italic' },
  archetypeRow: { paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, marginBottom: SPACING.md },
  archetypeLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: 4 },
  archetypeValue: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.violet, marginBottom: 2 },
  archetypeInspired: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontStyle: 'italic' },
  regenBtn: { marginTop: SPACING.sm, borderWidth: 1, borderColor: COLORS.violet + '66', borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: COLORS.violet + '15' },
  regenBtnText: { color: COLORS.violet, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold, letterSpacing: 0.5 },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: FONTS.weights.bold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: SPACING.sm },
  genreList: { gap: SPACING.sm },
  genreRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  genreRank: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, width: 24 },
  genreBarContainer: { flex: 1 },
  genreName: { fontSize: FONTS.sizes.xs, color: COLORS.text, marginBottom: 4, textTransform: 'capitalize' },
  genreBarBg: { height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
  genreBar: { height: '100%', borderRadius: 2 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  trackRank: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, width: 24 },
  trackImage: { width: 44, height: 44, borderRadius: 8 },
  trackImageFallback: { backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  trackInfo: { flex: 1 },
  trackName: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: FONTS.weights.medium },
  trackArtist: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  trackDuration: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  artistScroll: { marginHorizontal: -SPACING.md, paddingHorizontal: SPACING.md },
  artistChip: { alignItems: 'center', marginRight: SPACING.sm, backgroundColor: COLORS.bgCard, borderRadius: 16, borderWidth: 1.5, minWidth: 88, padding: SPACING.sm },
  artistImage: { width: 64, height: 64, borderRadius: 32, marginBottom: 8 },
  artistAvatarText: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold },
  artistChipName: { fontSize: FONTS.sizes.xs, color: COLORS.text, fontWeight: FONTS.weights.medium, textAlign: 'center', maxWidth: 80 },
  artistGenre: { fontSize: 9, color: COLORS.textMuted, textAlign: 'center', maxWidth: 80, textTransform: 'capitalize', marginTop: 2 },
});