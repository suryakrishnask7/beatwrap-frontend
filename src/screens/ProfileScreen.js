import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Linking, Switch, Image, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { COLORS, FONTS, SPACING } from '../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from '../services/notificationService';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [stats, setStats] = useState({ wraps: '—', moodDays: '—', friends: '—' });
  const [loadingStats, setLoadingStats] = useState(true);
  const [currentWrap, setCurrentWrap] = useState(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => { 
    loadStats(); 
    loadCurrentWrap(); 
    AsyncStorage.getItem('notifications_on').then(val => {
      setNotificationsOn(val !== 'false');
    });
  }, [user?._id]);

  const handleToggleNotifications = async (val) => {
    setNotificationsOn(val);
    await AsyncStorage.setItem('notifications_on', val ? 'true' : 'false');
    if (val) {
      notificationService.scheduleDailyReminder(user);
    } else {
      notificationService.cancelAllReminders();
    }
  };

  const loadStats = async () => {
    try { const cached = await AsyncStorage.getItem('profile_stats'); if (cached) setStats(JSON.parse(cached)); } catch {}
    if (!user?._id || user.isGuest) { setLoadingStats(false); return; }
    try {
      const res = await apiService.getProfileStats();
      const s = { wraps: res.wraps ?? 0, moodDays: res.moodDays ?? 0, friends: res.friends ?? 0 };
      setStats(s);
      await AsyncStorage.setItem('profile_stats', JSON.stringify(s));
    } catch {
      try {
        const wrapRaw = await AsyncStorage.getItem('weekly_wrap');
        const moodRaw = await AsyncStorage.getItem('mood_logs');
        const friendsRaw = await AsyncStorage.getItem('friends_list');
        setStats({
          wraps: wrapRaw ? 1 : 0,
          moodDays: moodRaw ? Object.keys(JSON.parse(moodRaw)).length : 0,
          friends: friendsRaw ? JSON.parse(friendsRaw).length : 0,
        });
      } catch {}
    } finally { setLoadingStats(false); }
  };

  const loadCurrentWrap = async () => {
    try {
      const cached = await AsyncStorage.getItem('weekly_wrap');
      if (cached) { const { wrap } = JSON.parse(cached); setCurrentWrap(wrap); }
    } catch {}
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Your local data will be cleared. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await AsyncStorage.clear(); signOut(); } },
    ]);
  };

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'This will delete your locally cached wrap data. Your account stays intact.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['weekly_wrap', 'mood_logs', 'profile_stats', 'daily_music']);
          setStats({ wraps: 0, moodDays: 0, friends: 0 });
          setCurrentWrap(null);
          Alert.alert('Done', 'Cache cleared.');
        },
      },
    ]);
  };

  const isGuest = user?.isGuest;
  const initials = user?.displayName ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  const SECTION_SETTINGS = [
    {
      title: 'PREFERENCES',
      items: [
        { icon: '🔔', label: 'Daily Sync Reminder', right: <Switch value={notificationsOn} onValueChange={handleToggleNotifications} trackColor={{ false: '#2A2A40', true: '#FF336688' }} thumbColor={notificationsOn ? '#FF3366' : '#9090B0'} /> },
        { icon: '🌙', label: 'Dark Mode', right: <Text style={styles.settingValue}>Always On</Text> },
      ],
    },
    {
      title: 'ACCOUNT',
      items: [
        ...(!isGuest ? [{ icon: '🎵', label: 'Spotify Account', sub: user?.email || 'Connected', onPress: () => Linking.openURL('https://www.spotify.com/account'), chevron: true }] : []),
        { icon: '🗑️', label: 'Clear Cache', onPress: handleClearCache, chevron: true },
        { icon: '🔒', label: 'Data & Privacy', onPress: () => Linking.openURL('https://www.spotify.com/privacy'), chevron: true },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: '💬', label: 'Send Feedback', onPress: () => Linking.openURL('mailto:feedback@beatwrap.app?subject=BeatWrap Feedback'), chevron: true },
        { icon: '⭐', label: 'Rate BeatWrap!', onPress: () => Linking.openURL('https://play.google.com/store'), chevron: true },
        { icon: '🔔', label: 'Test AI Notification', onPress: () => notificationService.testNotification(user), chevron: true },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={styles.heroWrap}>
          {/* Ambient orbs */}
          <View style={[styles.orb, { backgroundColor: '#FF336644', top: -30, right: -20, width: 160, height: 160 }]} />
          <View style={[styles.orb, { backgroundColor: '#8B5CF644', bottom: 0, left: -40, width: 200, height: 200 }]} />
          <LinearGradient colors={['#1A0A2E', '#0A0A0F']} style={styles.heroGrad}>
            {/* Settings icon top right */}
            <View style={styles.heroTopRow}>
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={styles.settingsIconBtn}>
                <Text style={styles.settingsIcon}>⚙</Text>
              </TouchableOpacity>
            </View>

            {/* Avatar */}
            <View style={styles.avatarWrap}>
              {user?.profileImage && !imageError
                ? <Image source={{ uri: user.profileImage }} style={styles.avatar} onError={() => setImageError(true)} />
                : <LinearGradient colors={['#FF3366', '#8B5CF6']} style={styles.avatar}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </LinearGradient>
              }
              {/* Edit pencil — no play button */}
              <View style={styles.avatarEditDot}>
                <Text style={{ fontSize: 10, color: '#0A0A0F' }}>✎</Text>
              </View>
            </View>

            <Text style={styles.userName}>{user?.displayName || 'Listener'}</Text>
            {user?.username && <Text style={styles.userHandle}>@{user.username}</Text>}
            <Text style={styles.userEmail}>{user?.email || ''}</Text>

            {isGuest ? (
              <View style={styles.guestBadge}><Text style={styles.guestBadgeText}>👤 Guest Mode</Text></View>
            ) : (
              <TouchableOpacity style={styles.spotifyBadge} onPress={() => Linking.openURL('https://www.spotify.com/account')}>
                <Text style={styles.spotifyBadgeText}>♫ Connected via Spotify  ●</Text>
              </TouchableOpacity>
            )}

            {/* This week card — no play button */}
            {currentWrap?.tamil_character?.name && (
              <View style={styles.thisWeekCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.thisWeekLabel}>This week</Text>
                  <Text style={styles.thisWeekName}>{currentWrap.tamil_character.name}</Text>
                  <Text style={styles.thisWeekFilm}>{currentWrap.tamil_character.film}</Text>
                </View>
                {/* No play button per spec */}
              </View>
            )}
          </LinearGradient>
        </View>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          {[
            { label: 'Wraps', value: stats.wraps },
            { label: 'Mood Days', value: stats.moodDays },
            { label: 'Friends', value: stats.friends },
          ].map((s, i) => (
            <View key={i} style={[styles.statItem, i < 2 && styles.statDivider]}>
              {loadingStats
                ? <ActivityIndicator size="small" color="#FF3366" />
                : <Text style={styles.statValue}>{s.value}</Text>
              }
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Settings Sections ── */}
        {SECTION_SETTINGS.map(({ title, items }) => (
          <View key={title} style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.settingsCard}>
              {items.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.settingRow, i < items.length - 1 && styles.settingRowBorder]}
                  onPress={item.onPress}
                  activeOpacity={item.onPress ? 0.7 : 1}
                  disabled={!item.onPress && !item.right}
                >
                  <Text style={styles.settingIcon2}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>{item.label}</Text>
                    {item.sub && <Text style={styles.settingSubLabel}>{item.sub}</Text>}
                  </View>
                  {item.right || (item.chevron && <Text style={styles.chevron}>›</Text>)}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* ── About ── */}
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>BeatWrap! v1.0</Text>
          <Text style={styles.aboutText}>Wrapped In Your Rhythm. Weekly music stories powered by Spotify + Groq AI. Tamil-flavoured, cinematic, made for you.</Text>
          <View style={styles.techRow}>
            {['Spotify API', 'Groq AI', 'Llama 3.3 70B'].map((t, i) => (
              <View key={i} style={styles.techPill}><Text style={styles.techPillText}>{t}</Text></View>
            ))}
          </View>
        </View>

        {/* ── Sign Out ── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Made with 🎵 for music lovers</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { paddingTop: 0 },

  heroWrap: { position: 'relative', overflow: 'hidden', marginBottom: 0 },
  orb: { position: 'absolute', borderRadius: 100, opacity: 0.5 },
  heroGrad: { alignItems: 'center', paddingBottom: 28, paddingHorizontal: 20 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, width: '100%', marginBottom: 16 },
  settingsIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  settingsIcon: { fontSize: 18, color: '#9090B0' },

  avatarWrap: { width: 90, height: 90, borderRadius: 45, marginBottom: 14, position: 'relative' },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 32, fontWeight: '900', color: '#fff' },
  avatarEditDot: { position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FF3366', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1A0A2E' },

  userName: { fontSize: 22, fontWeight: '800', color: '#F0F0FF', marginBottom: 3 },
  userHandle: { fontSize: 14, color: '#FF3366', marginBottom: 3 },
  userEmail: { fontSize: 12, color: '#9090B0', marginBottom: 14 },

  spotifyBadge: { backgroundColor: '#1DB95422', borderWidth: 1, borderColor: '#1DB95466', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 16 },
  spotifyBadgeText: { color: '#1DB954', fontSize: 12, fontWeight: '600' },
  guestBadge: { backgroundColor: '#1A1A28', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 16 },
  guestBadgeText: { color: '#9090B0', fontSize: 12 },

  thisWeekCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    width: '100%',
  },
  thisWeekLabel: { fontSize: 9, color: '#9090B0', fontWeight: '700', letterSpacing: 1.5, marginBottom: 3 },
  thisWeekName: { fontSize: 16, color: '#F0F0FF', fontWeight: '800' },
  thisWeekFilm: { fontSize: 12, color: '#9090B0' },

  // Stats
  statsRow: { flexDirection: 'row', backgroundColor: '#111118', marginHorizontal: 20, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2A2A40', marginBottom: 24, marginTop: -1 },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statDivider: { borderRightWidth: 1, borderRightColor: '#2A2A40' },
  statValue: { fontSize: 26, fontWeight: '900', color: '#F0F0FF', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: '#9090B0', marginTop: 3, fontWeight: '500' },

  // Settings
  sectionTitle: { fontSize: 11, color: '#9090B0', fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, paddingHorizontal: 20 },
  settingsCard: { backgroundColor: '#111118', borderRadius: 16, marginHorizontal: 20, borderWidth: 1, borderColor: '#2A2A40', overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1A1A28' },
  settingIcon2: { fontSize: 18, width: 28 },
  settingLabel: { fontSize: 14, color: '#F0F0FF', fontWeight: '500' },
  settingSubLabel: { fontSize: 11, color: '#9090B0', marginTop: 1 },
  settingValue: { fontSize: 12, color: '#9090B0' },
  chevron: { fontSize: 20, color: '#5A5A7A' },

  // About
  aboutCard: { backgroundColor: '#111118', borderRadius: 16, marginHorizontal: 20, padding: 18, borderWidth: 1, borderColor: '#2A2A40', marginBottom: 20 },
  aboutTitle: { fontSize: 15, fontWeight: '700', color: '#F0F0FF', marginBottom: 6 },
  aboutText: { fontSize: 12, color: '#9090B0', lineHeight: 20, marginBottom: 12 },
  techRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  techPill: { backgroundColor: '#0A0A0F', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#2A2A40' },
  techPillText: { color: '#9090B0', fontSize: 10, fontWeight: '600' },

  signOutBtn: { marginHorizontal: 20, borderRadius: 14, borderWidth: 1.5, borderColor: '#FF336644', padding: 16, alignItems: 'center', marginBottom: 14, backgroundColor: '#FF336608' },
  signOutText: { color: '#FF3366', fontSize: 14, fontWeight: '700' },
  footer: { textAlign: 'center', color: '#5A5A7A', fontSize: 12, paddingBottom: 8 },
});