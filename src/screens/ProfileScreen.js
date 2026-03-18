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

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [stats, setStats] = useState({ wraps: '—', moodDays: '—', friends: '—' });
  const [loadingStats, setLoadingStats] = useState(true);
  const [currentWrap, setCurrentWrap] = useState(null);

  useEffect(() => {
    loadStats();
    loadCurrentWrap();
  }, [user?._id]);

  const loadStats = async () => {
    // Load from cache instantly
    try {
      const cached = await AsyncStorage.getItem('profile_stats');
      if (cached) setStats(JSON.parse(cached));
    } catch {}

    if (!user?._id || user.isGuest) { setLoadingStats(false); return; }

    try {
      const res = await apiService.getProfileStats();
      const s = { wraps: res.wraps ?? 0, moodDays: res.moodDays ?? 0, friends: res.friends ?? 0 };
      setStats(s);
      await AsyncStorage.setItem('profile_stats', JSON.stringify(s));
    } catch (e) {
      // Fall back to local data
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
    } finally {
      setLoadingStats(false);
    }
  };

  const loadCurrentWrap = async () => {
    try {
      const cached = await AsyncStorage.getItem('weekly_wrap');
      if (cached) {
        const { wrap } = JSON.parse(cached);
        setCurrentWrap(wrap);
      }
    } catch {}
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Your local data will be cleared. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.clear();
          signOut();
        },
      },
    ]);
  };

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'This will delete your locally cached wrap data. Your account stays intact.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['weekly_wrap', 'mood_logs', 'mood_logs_array', 'profile_stats', 'daily_music']);
          setStats({ wraps: 0, moodDays: 0, friends: 0 });
          setCurrentWrap(null);
          Alert.alert('Done', 'Cache cleared successfully.');
        },
      },
    ]);
  };

  const isGuest = user?.isGuest;
  const initials = user?.displayName ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Profile Hero */}
        <LinearGradient colors={['#1A0A2E', '#0A0A0F']} style={styles.profileHero}>
          {/* Avatar — real profile picture if available */}
          <View style={styles.avatarWrap}>
            {user?.profileImage ? (
              <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />
            ) : (
              <LinearGradient colors={[COLORS.accent, COLORS.violet]} style={styles.avatarGradient}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </LinearGradient>
            )}
          </View>

          <Text style={styles.userName}>{user?.displayName || 'Listener'}</Text>
          {user?.username && <Text style={styles.userHandle}>@{user.username}</Text>}
          <Text style={styles.userEmail}>{user?.email || ''}</Text>

          {isGuest ? (
            <View style={styles.guestBadge}>
              <Text style={styles.guestBadgeText}>👤 Guest Mode</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.spotifyBadge} onPress={() => Linking.openURL('https://www.spotify.com/account')}>
              <Text style={styles.spotifyBadgeText}>♫ Connected via Spotify  →</Text>
            </TouchableOpacity>
          )}

          {/* Current Tamil character */}
          {currentWrap?.tamil_character?.name && (
            <View style={styles.characterBadge}>
              <Text style={styles.characterBadgeLabel}>THIS WEEK</Text>
              <Text style={styles.characterBadgeName}>{currentWrap.tamil_character.name}</Text>
              <Text style={styles.characterBadgeFilm}>{currentWrap.tamil_character.film}</Text>
            </View>
          )}
        </LinearGradient>

        {/* Real Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Wraps', value: stats.wraps },
            { label: 'Mood Days', value: stats.moodDays },
            { label: 'Friends', value: stats.friends },
          ].map((s, i) => (
            <View key={i} style={[styles.statItem, i < 2 && styles.statDivider]}>
              {loadingStats ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <Text style={styles.statItemValue}>{s.value}</Text>
              )}
              <Text style={styles.statItemLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Preferences */}
        <Text style={styles.sectionTitle}>PREFERENCES</Text>
        <View style={styles.settingsList}>
          <View style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
            <Text style={styles.settingIcon}>🔔</Text>
            <Text style={styles.settingLabel}>Weekly Wrap Reminder</Text>
            <Switch
              value={notificationsOn}
              onValueChange={setNotificationsOn}
              trackColor={{ false: COLORS.border, true: COLORS.accent + '88' }}
              thumbColor={notificationsOn ? COLORS.accent : COLORS.textMuted}
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingIcon}>🌙</Text>
            <Text style={styles.settingLabel}>Dark Mode</Text>
            <Text style={styles.settingValueText}>Always On</Text>
          </View>
        </View>

        {/* Account */}
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.settingsList}>
          {!isGuest && (
            <TouchableOpacity
              style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}
              onPress={() => Linking.openURL('https://www.spotify.com/account')}
            >
              <Text style={styles.settingIcon}>🎵</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Spotify Account</Text>
                <Text style={styles.settingSubLabel}>{user?.email || 'Connected'}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}
            onPress={handleClearCache}
          >
            <Text style={styles.settingIcon}>🗑️</Text>
            <Text style={styles.settingLabel}>Clear Cache</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => Linking.openURL('https://www.spotify.com/privacy')}>
            <Text style={styles.settingIcon}>🔒</Text>
            <Text style={styles.settingLabel}>Data & Privacy</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Support */}
        <Text style={styles.sectionTitle}>SUPPORT</Text>
        <View style={styles.settingsList}>
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}
            onPress={() => Linking.openURL('mailto:feedback@beatwrap.app?subject=BeatWrap Feedback')}
          >
            <Text style={styles.settingIcon}>💬</Text>
            <Text style={styles.settingLabel}>Send Feedback</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => Linking.openURL('https://play.google.com/store')}>
            <Text style={styles.settingIcon}>⭐</Text>
            <Text style={styles.settingLabel}>Rate BeatWrap!</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={styles.sectionTitle}>ABOUT</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>BeatWrap! v1.0</Text>
          <Text style={styles.aboutText}>
            Wrapped In Your Rhythm. A weekly music story powered by Spotify + Groq AI.
            Tamil-flavoured, cinematic, and made just for you.
          </Text>
          <View style={styles.aboutTech}>
            {['Spotify API', 'Groq AI', 'Llama 3.3 70B'].map((t, i) => (
              <View key={i} style={styles.techPill}>
                <Text style={styles.techPillText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Made with 🎵 for music lovers</Text>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingTop: 60 },

  profileHero: { alignItems: 'center', paddingVertical: SPACING.xl, paddingBottom: SPACING.lg, marginBottom: SPACING.md },
  avatarWrap: { width: 88, height: 88, borderRadius: 44, marginBottom: SPACING.md, overflow: 'hidden', shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8 },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarGradient: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: FONTS.sizes.xxxl, fontWeight: FONTS.weights.black, color: COLORS.white },
  userName: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.text, marginBottom: 2 },
  userHandle: { fontSize: FONTS.sizes.sm, color: COLORS.accent, marginBottom: 2 },
  userEmail: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: SPACING.md },
  spotifyBadge: { backgroundColor: '#1DB95422', borderWidth: 1, borderColor: '#1DB95466', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: SPACING.md },
  spotifyBadgeText: { color: '#1DB954', fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.medium },
  guestBadge: { backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: SPACING.md },
  guestBadgeText: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs },
  characterBadge: { marginTop: SPACING.sm, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  characterBadgeLabel: { fontSize: 9, color: COLORS.accent, fontWeight: FONTS.weights.bold, letterSpacing: 2, marginBottom: 2 },
  characterBadgeName: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: FONTS.weights.bold },
  characterBadgeFilm: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

  statsRow: { flexDirection: 'row', backgroundColor: COLORS.bgCard, marginHorizontal: SPACING.md, borderRadius: 16, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.lg },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statDivider: { borderRightWidth: 1, borderRightColor: COLORS.border },
  statItemValue: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.black, color: COLORS.text },
  statItemLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },

  sectionTitle: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: FONTS.weights.bold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: SPACING.sm, paddingHorizontal: SPACING.md },
  settingsList: { backgroundColor: COLORS.bgCard, borderRadius: 16, marginHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.lg, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  settingIcon: { fontSize: 20, width: 28 },
  settingLabel: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.text },
  settingSubLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 1 },
  settingValueText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  chevron: { fontSize: FONTS.sizes.xl, color: COLORS.textMuted },

  aboutCard: { backgroundColor: COLORS.bgCard, borderRadius: 16, marginHorizontal: SPACING.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.lg },
  aboutTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.text, marginBottom: 6 },
  aboutText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, lineHeight: 20, marginBottom: SPACING.sm },
  aboutTech: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  techPill: { backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.border },
  techPillText: { color: COLORS.textMuted, fontSize: 10 },

  signOutBtn: { marginHorizontal: SPACING.md, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.accent + '66', padding: SPACING.md, alignItems: 'center', marginBottom: SPACING.md },
  signOutText: { color: COLORS.accent, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
  footer: { textAlign: 'center', color: COLORS.textMuted, fontSize: FONTS.sizes.xs, paddingBottom: SPACING.md },
});