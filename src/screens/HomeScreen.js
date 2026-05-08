import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, RefreshControl, ActivityIndicator, Dimensions,
  Image, Alert, Pressable, Modal, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../context/AuthContext';
import { spotifyService } from '../services/spotifyService';
import { groqService } from '../services/groqService';
import { COLORS, FONTS, SPACING } from '../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/apiService';
// listeningSync removed — backend cron job handles all Spotify polling now
import { notificationService } from '../services/notificationService';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

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
  story: 'This week you drifted through sounds like a silhouette in a slow-motion scene.',
  tamil_character: { name: 'Vikram', film: 'Pithamagan', why_this_character: 'A presence that speaks through silence.' },
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
  explorationIndex: 40,
  discoveryRate: 75,
  replayFrequency: 12,
  estimatedMinutes: 320,
};

// Decorative waveform SVG
function WaveForm({ color = '#FF3366', opacity = 0.4, height = 40 }) {
  const w = width - 48;
  const pts = [0,18,8,10,16,28,24,5,32,22,40,14,48,30,56,8,64,24,72,12,80,28,88,6,96,20,104,16,112,26,120,9,128,22,136,18,144,28,152,10,160,24,168,14,176,26,184,8,192,20,200,16,208,28,216,6,224,22,232,12,240,26,248,10,256,20,264,15];
  let d = '';
  for (let i = 0; i < pts.length - 2; i += 2) {
    const x = (pts[i] / 270) * w;
    const y = height - (pts[i + 1] / 32) * height;
    d += (i === 0 ? 'M' : 'L') + `${x},${y} `;
  }
  return (
    <Svg width={w} height={height} style={{ opacity }}>
      <Path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export default function HomeScreen({ navigation }) {
  const { user, spotifyToken, signOut, loading: authLoading } = useAuth();
  const [wrap, setWrap] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [showAllArtists, setShowAllArtists] = useState(false);
  const [spotifyProfileImg, setSpotifyProfileImg] = useState(null);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistGenerated, setPlaylistGenerated] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const didLoad = useRef(false);

  // Tap-to-reveal for stats
  const [revealedStats, setRevealedStats] = useState({});
  const revealAnims = useRef({
    explore: new Animated.Value(0),
    discovery: new Animated.Value(0),
    replay: new Animated.Value(0),
  }).current;

  const revealStat = (key) => {
    if (revealedStats[key]) return;
    setRevealedStats(prev => ({ ...prev, [key]: true }));
    Animated.spring(revealAnims[key], {
      toValue: 1,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleGeneratePlaylist = async () => {
    try {
      setPlaylistLoading(true);
      const res = await apiService.exportPlaylist();
      if (res.success) {
        setPlaylistGenerated(true);
        setPlaylistUrl(res.url);
      }
    } catch (e) {
      alert("Failed to generate playlist. Ensure you've re-logged in to grant playlist permissions!");
    } finally {
      setPlaylistLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (didLoad.current) return;
    didLoad.current = true;
    loadData();
  }, [authLoading]);

  // Schedule daily reminder notification (sync is now server-side)
  useEffect(() => {
    if (!spotifyToken || isGuest) return;
    AsyncStorage.getItem('notifications_on').then(val => {
      if (val !== 'false' && user) notificationService.scheduleDailyReminder(user);
    });
  }, [spotifyToken]);

  // If user object has no profileImage (old accounts), fetch from Spotify in background
  useEffect(() => {
    if (!spotifyToken || user?.profileImage || spotifyProfileImg) return;
    import('axios').then(({ default: axios }) => {
      axios.get('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${spotifyToken}` },
      }).then(res => {
        const img = res.data.images?.[0]?.url || res.data.images?.[1]?.url;
        if (img) setSpotifyProfileImg(img);
      }).catch(() => {});
    });
  }, [spotifyToken, user?.profileImage]);

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
        // Force refresh if the cached data is missing 'story' (e.g. from an old broken AI generation)
        if (data.weekKey === getCurrentWeekKey() && data.wrap?.story) {
          setWrap(data.wrap);
          setStats(data.stats);
          fetchStatsOnly();
          return;
        } else if (data.weekKey !== getCurrentWeekKey()) {
          await AsyncStorage.setItem('prev_weekly_wrap', cached);
        }
      }
      await fetchFreshData();
    } catch (e) {
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
      // Pull stats from backend (server cron keeps them fresh)
      const weekKey = getCurrentWeekKey();
      const history = await apiService.getListeningHistory(weekKey);
      if (history?.found) {
        // Use backend-tracked top tracks/artists (from actual play counts)
        const hasBackendTracks = history.topTracksOfWeek?.length > 0;
        const hasBackendArtists = history.topArtistsOfWeek?.length > 0;

        const backendStats = {
          ...history.stats,
          estimatedMinutes: history.stats?.estimatedMinutes || 0,
          // Map topTracksOfWeek to the format HomeScreen expects
          topTracks: hasBackendTracks
            ? history.topTracksOfWeek.map(t => ({
                id: t.trackId, name: t.name,
                artists: [{ name: t.artist }],
                album: { images: t.albumImg ? [{ url: t.albumImg }] : [] },
                duration_ms: t.durationMs || 0,
                _plays: t.plays,
              }))
            : stats?.topTracks || [],
          topArtists: hasBackendArtists
            ? history.topArtistsOfWeek.map(a => ({
                id: a.artistId, name: a.name,
                images: a.image ? [{ url: a.image }] : [],
                genres: a.genres || [],
                _plays: a.plays,
              }))
            : stats?.topArtists || [],
          topGenres: history.topGenres || [],
        };
        setStats(backendStats);
        const cached = await AsyncStorage.getItem('weekly_wrap');
        if (cached) {
          const data = JSON.parse(cached);
          await AsyncStorage.setItem('weekly_wrap', JSON.stringify({ ...data, stats: backendStats }));
        }
      }
    } catch (e) { console.error('Stats refresh error:', e); }
  };

  const fetchFreshData = async () => {
    try {
      if (!spotifyToken) { setWrap(GUEST_WRAP); setStats(GUEST_STATS); return; }
      const currentWeekKey = getCurrentWeekKey();

      // 1. Check if we already have a wrap saved in the cloud
      try {
        const cloudData = await apiService.getWrapFromCloud(currentWeekKey);
        if (cloudData.found) {
          setWrap(cloudData.wrap); setStats(cloudData.stats);
          await AsyncStorage.setItem('weekly_wrap', JSON.stringify({ wrap: cloudData.wrap, stats: cloudData.stats, weekKey: currentWeekKey }));
          // Refresh stats from backend in the background (cron may have updated)
          fetchStatsOnly();
          return;
        }
      } catch {}

      // 2. No wrap yet — fetch backend listening history
      const history = await apiService.getListeningHistory(currentWeekKey).catch(() => null);
      const hasBackendData = history?.found && history.topTracksOfWeek?.length > 0;

      let computedStats;

      if (hasBackendData) {
        // ── USE BACKEND DATA (accurate, from cron) ────────────────────────
        computedStats = {
          ...history.stats,
          estimatedMinutes: history.stats?.estimatedMinutes || 0,
          topTracks: history.topTracksOfWeek.map(t => ({
            id: t.trackId, name: t.name,
            artists: [{ name: t.artist }],
            album: { images: t.albumImg ? [{ url: t.albumImg }] : [] },
            duration_ms: t.durationMs || 0,
            _plays: t.plays,
          })),
          topArtists: (history.topArtistsOfWeek || []).map(a => ({
            id: a.artistId, name: a.name,
            images: a.image ? [{ url: a.image }] : [],
            genres: a.genres || [],
            _plays: a.plays,
          })),
          topGenres: history.topGenres || [],
        };
      } else {
        // ── FALLBACK: Spotify API for brand-new users with no cron data yet ─
        const [tracks, artists] = await Promise.all([
          spotifyService.getTopTracks(spotifyToken, 'short_term', 20),
          spotifyService.getTopArtists(spotifyToken, 'short_term', 20),
        ]);
        computedStats = spotifyService.computeListeningStats(tracks, artists, []);
        computedStats.estimatedMinutes = history?.stats?.estimatedMinutes || 0;
        computedStats.topTracks = tracks;
        computedStats.topArtists = artists;
        computedStats.topGenres = history?.topGenres || computedStats.topGenres || [];
      }

      await AsyncStorage.setItem('my_top_tracks', JSON.stringify(computedStats.topTracks));

      // Build mood logs for AI prompt
      const storedMoods = await AsyncStorage.getItem('mood_logs');
      const moodLogsRaw = storedMoods ? JSON.parse(storedMoods) : {};
      const DAYS_LIST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      let moods = [];
      if (Array.isArray(moodLogsRaw)) moods = moodLogsRaw.filter(Boolean);
      else if (moodLogsRaw && typeof moodLogsRaw === 'object') {
        moods = Object.entries(moodLogsRaw).map(([idx, log]) => log ? ({ day: DAYS_LIST[parseInt(idx)] || idx, ...log }) : null).filter(Boolean);
      }

      const aiWrap = await groqService.generateWeeklyWrap(computedStats, moods);
      setStats(computedStats); setWrap(aiWrap);
      await AsyncStorage.setItem('weekly_wrap', JSON.stringify({ wrap: aiWrap, stats: computedStats, weekKey: currentWeekKey }));

      try {
        const saved = await apiService.saveWrapToCloud(currentWeekKey, aiWrap, computedStats);
        if (saved.saved === false && saved.wrap) {
          setWrap(saved.wrap); setStats(saved.stats);
          await AsyncStorage.setItem('weekly_wrap', JSON.stringify({ wrap: saved.wrap, stats: saved.stats, weekKey: currentWeekKey }));
        }
      } catch {}

    } catch (e) {
      if (e?.response?.status === 401) { signOut(); return; }
      setWrap(GUEST_WRAP); setStats(GUEST_STATS);
    }
  };

  const regenerateCharacter = async () => {
    if (!wrap || isGuest) return;
    setRegenLoading(true);
    try {
      const storedMoods = await AsyncStorage.getItem('mood_logs');
      const moodLogsRaw = storedMoods ? JSON.parse(storedMoods) : {};
      const DAYS_LIST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      let moods = [];
      if (Array.isArray(moodLogsRaw)) moods = moodLogsRaw.filter(Boolean);
      else if (moodLogsRaw && typeof moodLogsRaw === 'object') {
        moods = Object.entries(moodLogsRaw).map(([idx, log]) => log ? ({ day: DAYS_LIST[parseInt(idx)] || idx, ...log }) : null).filter(Boolean);
      }
      
      const newAiWrap = await groqService.generateWeeklyWrap(stats, moods, wrap.tamil_character?.name);
      
      const result = await apiService.regenerateCharacter(getCurrentWeekKey(), newAiWrap);
      const updatedWrap = { ...wrap, ...result.wrap };
      setWrap(updatedWrap);
      const cached = await AsyncStorage.getItem('weekly_wrap');
      if (cached) {
        const data = JSON.parse(cached);
        await AsyncStorage.setItem('weekly_wrap', JSON.stringify({ ...data, wrap: updatedWrap }));
      }
    } catch (e) {
      if (e?.response?.status === 429) {
        Alert.alert('Come back tomorrow 🎭', e.response.data?.message || 'Once per day limit.', [{ text: 'Got it' }]);
      } else Alert.alert('Error', 'Could not regenerate character.');
    } finally { setRegenLoading(false); }
  };

  const onRefresh = async () => {
    if (isGuest) return;
    setRefreshing(true);
    await fetchStatsOnly();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0A0A0F', '#12121E']} style={StyleSheet.absoluteFillObject} />
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Crafting your wrap...</Text>
      </View>
    );
  }

  const statCards = [
    { key: 'explore', label: 'EXPLORE', value: stats?.explorationIndex || 0, delta: '+18', color: '#FF6B35', icon: '🔭' },
    { key: 'discovery', label: 'DISCOVERY', value: stats?.discoveryRate || 0, delta: '+53', color: '#8B5CF6', icon: '✦' },
    { key: 'replay', label: 'REPLAY', value: stats?.replayFrequency || 0, delta: '-5', color: '#06B6D4', icon: '↻', negative: true },
  ];

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {isGuest && (
        <View style={styles.guestBanner}>
          <Text style={styles.guestBannerText}>👀 Preview — </Text>
          <TouchableOpacity onPress={async () => { await AsyncStorage.removeItem('guest_mode'); signOut(); }}>
            <Text style={styles.guestBannerLink}>Sign in with Spotify →</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        contentContainerStyle={[styles.scrollContent, isGuest && { paddingTop: 88 }]}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{isGuest ? 'Guest' : (user?.displayName || 'listener')}</Text>
            {/* Minutes listened pill */}
            {!isGuest && stats?.estimatedMinutes > 0 && (
              <View style={styles.minutesPill}>
                <Text style={styles.minutesValue}>{stats.estimatedMinutes}</Text>
                <Text style={styles.minutesLabel}> min this week</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatarBtn}>
            {(user?.profileImage || spotifyProfileImg)
              ? <Image
                  source={{ uri: user?.profileImage || spotifyProfileImg }}
                  style={styles.avatarImg}
                  onError={() => {
                    setSpotifyProfileImg(null);
                    if (user && user.profileImage) {
                      user.profileImage = null; // force fallback to gradient
                    }
                  }}
                />
              : <LinearGradient colors={[COLORS.accent, COLORS.violet]} style={styles.avatarGrad}>
                  <Text style={styles.avatarInitial}>{user?.displayName?.[0]?.toUpperCase() || '♪'}</Text>
                </LinearGradient>
            }
            <View style={styles.avatarOnlineDot} />
          </TouchableOpacity>
        </View>

        {/* ── Character Card (THIS WEEK AS) ── */}
        {wrap?.tamil_character && (
          <View style={styles.characterCardOuter}>
            <LinearGradient
              colors={['#C0392B', '#8E1B8E', '#4A148C']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.characterCardGrad}
            >
              {/* Background waveform */}
              <View style={styles.waveformBg}>
                <WaveForm color="#FFFFFF" opacity={0.15} height={50} />
              </View>
              <View style={styles.characterCardContent}>
                <View style={styles.characterCardLeft}>
                  <Text style={styles.characterCardLabel}>THIS WEEK AS</Text>
                  <Text style={styles.characterCardName}>{wrap.tamil_character.name}</Text>
                  <Text style={styles.characterCardFilm}>{wrap.tamil_character.film}</Text>
                </View>
                {/* No play button — removed per spec */}
                <View style={styles.characterCardRight}>
                  <View style={styles.confidencePill}>
                    <Text style={styles.confidenceText}>{Math.round((wrap.confidence || 0.8) * 100)}%</Text>
                  </View>
                  {!isGuest && (
                    <TouchableOpacity onPress={regenerateCharacter} style={styles.regenMini} disabled={regenLoading}>
                      {regenLoading
                        ? <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
                        : <Text style={styles.regenMiniText}>🎭</Text>
                      }
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ── This Week Summary (moved right below character card) ── */}
        {wrap?.story && (
          <View style={styles.storyCard}>
            <Text style={styles.storyLabel}>THIS WEEK'S VIBE</Text>
            <Text style={styles.storyText}>{wrap.story}</Text>
            {wrap.dominant_vibe && (
              <View style={styles.vibePill}>
                <Text style={styles.vibeText}>{wrap.dominant_vibe}</Text>
              </View>
            )}
            
            {/* Generate Playlist Button */}
            {!isGuest && (
              <TouchableOpacity 
                style={[styles.playlistBtn, playlistGenerated && styles.playlistBtnSuccess]} 
                onPress={playlistGenerated ? () => Linking.openURL(playlistUrl) : handleGeneratePlaylist}
                disabled={playlistLoading}
              >
                <LinearGradient 
                  colors={playlistGenerated ? ['#1DB954', '#1AA34A'] : ['#1DB954', '#109943']} 
                  style={styles.playlistBtnGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  {playlistLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : playlistGenerated ? (
                    <Text style={styles.playlistBtnText}>✓ Open Playlist</Text>
                  ) : (
                    <Text style={styles.playlistBtnText}>🎵 Generate Playlist</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── "Your sound, your story" + stat pills ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Your sound, your story</Text>
        </View>

        {/* Stat Pills — tap to reveal */}
        <View style={styles.statRow}>
          {statCards.map(({ key, label, value, delta, color, icon, negative }) => {
            const revealed = revealedStats[key];
            const anim = revealAnims[key];
            const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
            const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
            const deltaColor = negative ? '#FF3366' : '#10B981';

            return (
              <Pressable key={key} style={styles.statPill} onPress={() => revealStat(key)}>
                <LinearGradient
                  colors={[color + '22', color + '11']}
                  style={styles.statPillGrad}
                >
                  <Text style={styles.statPillLabel}>{label}</Text>
                  {revealed ? (
                    <Animated.View style={{ transform: [{ scale }], opacity }}>
                      <Text style={[styles.statPillValue, { color }]}>{value}%</Text>
                      <Text style={[styles.statPillDelta, { color: deltaColor }]}>{delta}</Text>
                    </Animated.View>
                  ) : (
                    <View style={styles.statPillLocked}>
                      <Text style={[styles.statPillIcon, { color }]}>{icon}</Text>
                      <Text style={styles.statPillTap}>tap</Text>
                    </View>
                  )}
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        {/* ── Top Tracks ── */}
        {stats?.topTracks?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Top tracks</Text>
              <TouchableOpacity onPress={() => setShowAllTracks(true)}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {stats.topTracks.slice(0, 5).map((track, i) => (
              <TrackRow key={track.id || i} track={track} rank={i + 1} />
            ))}
          </View>
        )}

        {/* ── Top Artists ── */}
        {stats?.topArtists?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Top artists</Text>
              <TouchableOpacity onPress={() => setShowAllArtists(true)}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.artistScroll}>
              {stats.topArtists.slice(0, 8).map((artist, i) => (
                <ArtistChip key={artist.id || i} artist={artist} rank={i + 1} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── All Tracks Modal ── */}
      <Modal visible={showAllTracks} transparent animationType="slide" onRequestClose={() => setShowAllTracks(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Top Tracks</Text>
              <TouchableOpacity onPress={() => setShowAllTracks(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(stats?.topTracks || []).map((track, i) => (
                <TrackRow key={track.id || i} track={track} rank={i + 1} />
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── All Artists Modal ── */}
      <Modal visible={showAllArtists} transparent animationType="slide" onRequestClose={() => setShowAllArtists(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Top Artists</Text>
              <TouchableOpacity onPress={() => setShowAllArtists(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(stats?.topArtists || []).map((artist, i) => (
                <ArtistRow key={artist.id || i} artist={artist} rank={i + 1} />
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

function TrackRow({ track, rank }) {
  const imageUrl = track.album?.images?.[2]?.url || track.album?.images?.[0]?.url;
  const hasPlays = track._plays && track._plays > 0;
  const mins = Math.floor((track.duration_ms || 0) / 60000);
  const secs = String(Math.floor(((track.duration_ms || 0) % 60000) / 1000)).padStart(2, '0');

  return (
    <View style={styles.trackRow}>
      <Text style={styles.trackRank}>{rank}</Text>
      {imageUrl
        ? <Image source={{ uri: imageUrl }} style={styles.trackImage} />
        : <View style={[styles.trackImage, styles.trackImageFallback]}><Text style={{ fontSize: 16 }}>♪</Text></View>
      }
      <View style={styles.trackInfo}>
        <Text style={styles.trackName} numberOfLines={1}>{track.name}</Text>
        <Text style={styles.trackArtist} numberOfLines={1}>{track.artists?.[0]?.name}</Text>
      </View>
      {hasPlays
        ? <Text style={[styles.trackDur, { color: '#FF3366' }]}>{track._plays}×</Text>
        : <Text style={styles.trackDur}>{mins}:{secs}</Text>
      }
    </View>
  );
}

function ArtistRow({ artist, rank }) {
  const colors = ['#FF3366', '#8B5CF6', '#06B6D4', '#FFD700', '#10B981'];
  const color = colors[rank % colors.length];
  const imageUrl = artist.images?.[1]?.url || artist.images?.[0]?.url;
  return (
    <View style={styles.trackRow}>
      <Text style={styles.trackRank}>{rank}</Text>
      {imageUrl
        ? <Image source={{ uri: imageUrl }} style={styles.trackImage} />
        : <View style={[styles.trackImage, styles.trackImageFallback]}>
            <Text style={{ color, fontSize: 18, fontWeight: '800' }}>{artist.name?.[0]}</Text>
          </View>
      }
      <View style={styles.trackInfo}>
        <Text style={styles.trackName} numberOfLines={1}>{artist.name}</Text>
        {artist.genres?.[0] && <Text style={styles.trackArtist} numberOfLines={1}>{artist.genres[0]}</Text>}
      </View>
    </View>
  );
}

function ArtistChip({ artist, rank }) {
  const colors = ['#FF3366', '#8B5CF6', '#06B6D4', '#FFD700', '#10B981'];
  const color = colors[rank % colors.length];
  const imageUrl = artist.images?.[1]?.url || artist.images?.[0]?.url;
  return (
    <View style={styles.artistChip}>
      {imageUrl
        ? <Image source={{ uri: imageUrl }} style={styles.artistImg} />
        : <LinearGradient colors={[color + '55', color + '22']} style={styles.artistImg}>
            <Text style={[styles.artistInitial, { color }]}>{artist.name?.[0]}</Text>
          </LinearGradient>
      }
      <Text style={styles.artistName} numberOfLines={1}>{artist.name}</Text>
      {artist.genres?.[0] && <Text style={styles.artistGenre} numberOfLines={1}>{artist.genres[0]}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0F' },
  loadingText: { color: '#9090B0', marginTop: 16, fontSize: 13, letterSpacing: 0.5 },
  scrollContent: { paddingTop: 56, paddingHorizontal: 20 },

  guestBanner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: '#FFD70022', borderBottomWidth: 1, borderBottomColor: '#FFD70033',
    paddingTop: 44, paddingBottom: 8, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  guestBannerText: { color: '#FFD700', fontSize: 11, fontWeight: '700' },
  guestBannerLink: { color: '#FF3366', fontSize: 11, fontWeight: '700', textDecorationLine: 'underline' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 12, color: '#9090B0', fontWeight: '500', letterSpacing: 0.5, marginBottom: 3 },
  userName: { fontSize: 22, fontWeight: '800', color: '#F0F0FF', letterSpacing: -0.5 },
  avatarBtn: { position: 'relative' },
  avatarImg: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FF336633' },
  avatarGrad: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '800', color: '#fff' },
  avatarOnlineDot: { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#0A0A0F' },

  // Minutes pill (under greeting)
  minutesPill: { flexDirection: 'row', alignItems: 'center', marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#FF336611', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FF336633' },
  minutesValue: { fontSize: 13, fontWeight: '800', color: '#FF3366' },
  minutesLabel: { fontSize: 12, fontWeight: '500', color: '#FF3366', opacity: 0.8 },


  // Character Card
  characterCardOuter: { borderRadius: 20, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  characterCardGrad: { padding: 20, minHeight: 110 },
  waveformBg: { position: 'absolute', bottom: 0, left: 24, right: 24, opacity: 1 },
  characterCardContent: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  characterCardLeft: { flex: 1 },
  characterCardLabel: { fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '700', letterSpacing: 2.5, marginBottom: 6 },
  characterCardName: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1, marginBottom: 2 },
  characterCardFilm: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  characterCardRight: { alignItems: 'flex-end', gap: 8 },
  confidencePill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  confidenceText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  regenMini: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  regenMiniText: { fontSize: 16 },

  // Section Header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionHeaderText: { fontSize: 16, fontWeight: '700', color: '#F0F0FF' },
  seeAll: { fontSize: 11, color: '#FF3366', fontWeight: '600' },

  // Stat Pills
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statPill: { flex: 1 },
  statPillGrad: { borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', minHeight: 80 },
  statPillLabel: { fontSize: 8, color: '#9090B0', fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  statPillValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statPillDelta: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  statPillLocked: { alignItems: 'center', marginTop: 4 },
  statPillIcon: { fontSize: 20, marginBottom: 3 },
  statPillTap: { fontSize: 9, color: '#5A5A7A', fontWeight: '600', letterSpacing: 1 },

  // Section
  section: { marginBottom: 24 },

  // Tracks
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  trackRank: { width: 18, fontSize: 12, color: '#5A5A7A', textAlign: 'center', fontWeight: '600' },
  trackImage: { width: 46, height: 46, borderRadius: 10 },
  trackImageFallback: { backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  trackInfo: { flex: 1 },
  trackName: { fontSize: 14, color: '#F0F0FF', fontWeight: '600', marginBottom: 2 },
  trackArtist: { fontSize: 12, color: '#9090B0' },
  trackDur: { fontSize: 11, color: '#5A5A7A' },

  // Artists
  artistScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  artistChip: { alignItems: 'center', marginRight: 14, width: 76 },
  artistImg: { width: 64, height: 64, borderRadius: 32, marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  artistInitial: { fontSize: 22, fontWeight: '800' },
  artistName: { fontSize: 11, color: '#F0F0FF', fontWeight: '600', textAlign: 'center', maxWidth: 72 },
  artistGenre: { fontSize: 9, color: '#9090B0', textAlign: 'center', maxWidth: 72, marginTop: 2, textTransform: 'capitalize' },

  // Story Card
  storyCard: {
    backgroundColor: '#111118', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#2A2A40', marginBottom: 16,
  },
  storyLabel: { fontSize: 9, color: '#FF3366', fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  storyText: { fontSize: 13, color: '#9090B0', lineHeight: 22 },
  vibePill: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#FF336611', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#FF336633' },
  vibeText: { color: '#FF3366', fontSize: 11, fontWeight: '600' },
  playlistBtn: { marginTop: 16, borderRadius: 12, overflow: 'hidden', transform: [{ scale: 1 }] },
  playlistBtnSuccess: { opacity: 0.9 },
  playlistBtnGrad: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  playlistBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' },
  modalSheet: { backgroundColor: '#111118', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 0, paddingBottom: 0, maxHeight: '85%', borderWidth: 1, borderColor: '#2A2A40' },
  modalHandle: { width: 36, height: 4, backgroundColor: '#2A2A40', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A28', marginBottom: 4 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#F0F0FF', letterSpacing: -0.3 },
  modalClose: { fontSize: 16, color: '#9090B0', fontWeight: '700', paddingHorizontal: 6 },
});