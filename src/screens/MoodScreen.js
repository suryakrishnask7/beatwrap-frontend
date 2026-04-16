import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Dimensions, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { spotifyService } from '../services/spotifyService';
import { apiService } from '../services/apiService';
import { COLORS, FONTS, SPACING, MOODS } from '../utils/constants';

const { width } = Dimensions.get('window');
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getCurrentWeekKey = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};

export default function MoodScreen() {
  const { spotifyToken, user } = useAuth();
  const [moodLogs, setMoodLogs] = useState({});
  const [dailyMusic, setDailyMusic] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  const [note, setNote] = useState('');
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const hasFetchedFromAtlas = useRef(false);

  useEffect(() => {
    const day = new Date().getDay();
    setCurrentDayIndex(day === 0 ? 6 : day - 1);
    loadMoods();
    fetchDailyMusic();
  }, [user?._id]); // Re-run when user changes (login/logout)

  const loadMoods = async () => {
    // Step 1: Load from AsyncStorage immediately for instant display
    try {
      const stored = await AsyncStorage.getItem('mood_logs');
      if (stored) {
        setMoodLogs(JSON.parse(stored));
      }
    } catch {}

    // Step 2: Always sync from Atlas for logged-in non-guest users
    // This is the fix — we always fetch from Atlas, not just on first load
    if (!user?._id || user.isGuest) return;

    try {
      const weekKey = getCurrentWeekKey();
      const res = await apiService.getWeekMoods(weekKey);
      if (res.moods && Object.keys(res.moods).length > 0) {
        // Atlas has data — use it as source of truth
        setMoodLogs(res.moods);
        await AsyncStorage.setItem('mood_logs', JSON.stringify(res.moods));
      } else {
        // Atlas has nothing for this week — local cache might be stale from a previous week
        // Check if the local data is for the current week by verifying keys
        // If no Atlas data, reset local to empty for this week
        setMoodLogs({});
        await AsyncStorage.setItem('mood_logs', JSON.stringify({}));
      }
    } catch (e) {
      console.log('Could not sync moods from Atlas:', e?.message);
      // Keep whatever we loaded from AsyncStorage
    }
  };

  const fetchDailyMusic = async () => {
    if (!spotifyToken) return;

    // Check cache freshness — only re-fetch if older than 30 mins
    const lastFetchRaw = await AsyncStorage.getItem('daily_music_last_fetch');
    const lastFetch = lastFetchRaw ? parseInt(lastFetchRaw) : 0;
    const THIRTY_MINS = 30 * 60 * 1000;
    const cached = await AsyncStorage.getItem('daily_music');
    if (cached) setDailyMusic(JSON.parse(cached));
    if (Date.now() - lastFetch < THIRTY_MINS && cached) return;

    try {
      setLoadingMusic(true);
      const recent = await spotifyService.getRecentlyPlayed(spotifyToken, 50);
      const existingRaw = await AsyncStorage.getItem('daily_music');
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const byDay = { ...existing };

      recent.forEach(item => {
        const playedAt = new Date(item.played_at);
        const now = new Date();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        monday.setHours(0, 0, 0, 0);
        if (playedAt < monday) return; // Ignore tracks from previous weeks

        const dayOfWeek = playedAt.getDay();
        const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        if (!byDay[dayIdx]) byDay[dayIdx] = { tracks: [], artistMap: {} };
        if (byDay[dayIdx].tracks.length < 5) {
          const exists = byDay[dayIdx].tracks.find(t => t.id === item.track.id);
          if (!exists) byDay[dayIdx].tracks.push(item.track);
        }
        item.track.artists?.forEach(a => {
          if (!byDay[dayIdx].artistMap) byDay[dayIdx].artistMap = {};
          byDay[dayIdx].artistMap[a.id] = a.name;
        });
      });

      Object.keys(byDay).forEach(day => {
        if (byDay[day].artistMap) {
          byDay[day].artists = Object.values(byDay[day].artistMap).slice(0, 4);
          delete byDay[day].artistMap;
        }
      });

      setDailyMusic(byDay);
      await AsyncStorage.setItem('daily_music', JSON.stringify(byDay));
      await AsyncStorage.setItem('daily_music_last_fetch', String(Date.now()));
    } catch (e) {
      console.error('Daily music fetch error:', e?.response?.status, e.message);
    } finally {
      setLoadingMusic(false);
    }
  };

  const saveMood = async () => {
    if (!selectedMood || selectedDay === null) return;

    const updated = {
      ...moodLogs,
      [selectedDay]: {
        emoji: selectedMood.emoji,
        label: selectedMood.label,
        value: selectedMood.value,
        note,
        timestamp: Date.now(),
      },
    };

    // Update state and local cache immediately
    setMoodLogs(updated);
    await AsyncStorage.setItem('mood_logs', JSON.stringify(updated));

    // Save to Atlas
    if (user?._id && !user.isGuest) {
      try {
        const weekKey = getCurrentWeekKey();
        await apiService.saveMood(
          weekKey,
          selectedDay,
          DAYS[selectedDay],
          selectedMood.emoji,
          selectedMood.label,
          selectedMood.value,
          note
        );
      } catch (e) {
        console.log('Cloud mood save failed (offline?):', e?.message);
      }
    }

    setModalVisible(false);
    setNote('');
    setSelectedMood(null);
  };

  const openModal = (dayIndex) => {
    setSelectedDay(dayIndex);
    const existing = moodLogs[dayIndex];
    if (existing) {
      setSelectedMood(MOODS.find(m => m.value === existing.value) || null);
      setNote(existing.note || '');
    } else {
      setSelectedMood(null);
      setNote('');
    }
    setModalVisible(true);
  };

  const getMoodColor = (value) => {
    const map = {
      fired_up: COLORS.accent,
      chill: COLORS.cyan,
      midnight: COLORS.violet,
      electric: COLORS.gold,
      reflective: COLORS.textMuted,
      dramatic: '#FF6B6B',
    };
    return map[value] || COLORS.border;
  };

  const weekMoods = DAYS.map((day, i) => ({ day, index: i, log: moodLogs[i], music: dailyMusic[i] }));
  const loggedCount = Object.keys(moodLogs).length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Vibe Tracker</Text>
          <Text style={styles.subtitle}>Log your mood, feel the pattern.</Text>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>This Week</Text>
            <Text style={styles.progressCount}>{loggedCount}/7 days logged</Text>
          </View>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={[COLORS.accent, COLORS.violet]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${(loggedCount / 7) * 100}%` }]}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>WEEK CALENDAR</Text>
        <View style={styles.calendar}>
          {weekMoods.map(({ day, index, log }) => {
            const isToday = index === currentDayIndex;
            const hasLog = !!log;
            const color = hasLog ? getMoodColor(log.value) : COLORS.border;
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  { borderColor: color },
                  isToday && styles.todayCell,
                  hasLog && { backgroundColor: color + '18' },
                ]}
                onPress={() => openModal(index)}
              >
                <Text style={[styles.dayLabel, isToday && { color: COLORS.accent }]}>{day}</Text>
                <Text style={styles.dayEmoji}>{hasLog ? log.emoji : isToday ? '＋' : '·'}</Text>
                {hasLog && <Text style={[styles.dayMoodLabel, { color }]} numberOfLines={1}>{log.label}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>DAILY LOG</Text>
        {weekMoods.every(m => !m.log && !m.music?.tracks?.length) ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎭</Text>
            <Text style={styles.emptyText}>No logs yet this week.</Text>
            <Text style={styles.emptyHint}>Tap a day above to log your vibe.</Text>
          </View>
        ) : (
          weekMoods.map(({ day, index, log, music }) => {
            if (!log && !music?.tracks?.length) return null;
            const moodColor = log ? getMoodColor(log.value) : COLORS.border;
            return (
              <View key={index} style={styles.dayLogCard}>
                <LinearGradient colors={[COLORS.bgCard, COLORS.bg]} style={styles.dayLogGradient}>
                  <View style={styles.dayLogHeader}>
                    <View style={[styles.dayLogAccent, { backgroundColor: moodColor }]} />
                    <Text style={styles.dayLogDay}>{day}</Text>
                    {log ? (
                      <TouchableOpacity style={styles.moodBadge} onPress={() => openModal(index)}>
                        <Text style={styles.moodBadgeEmoji}>{log.emoji}</Text>
                        <Text style={[styles.moodBadgeLabel, { color: moodColor }]}>{log.label}</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.addMoodBtn} onPress={() => openModal(index)}>
                        <Text style={styles.addMoodBtnText}>+ Log mood</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {log?.note ? <Text style={styles.dayLogNote}>"{log.note}"</Text> : null}
                  {music?.tracks?.length > 0 && (
                    <View style={styles.musicSection}>
                      <Text style={styles.musicSectionLabel}>🎵 LISTENED TO</Text>
                      {music.tracks.map((track, ti) => {
                        const imgUrl = track.album?.images?.[2]?.url || track.album?.images?.[0]?.url;
                        return (
                          <View key={ti} style={styles.miniTrackRow}>
                            {imgUrl
                              ? <Image source={{ uri: imgUrl }} style={styles.miniTrackImg} />
                              : <View style={[styles.miniTrackImg, styles.miniTrackImgFallback]}><Text style={{ fontSize: 10 }}>♫</Text></View>
                            }
                            <View style={styles.miniTrackInfo}>
                              <Text style={styles.miniTrackName} numberOfLines={1}>{track.name}</Text>
                              <Text style={styles.miniTrackArtist} numberOfLines={1}>{track.artists?.[0]?.name}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                  {music?.artists?.length > 0 && (
                    <View style={styles.artistSection}>
                      <Text style={styles.musicSectionLabel}>🎤 ARTISTS</Text>
                      <View style={styles.artistPills}>
                        {music.artists.map((name, ai) => (
                          <View key={ai} style={styles.artistPill}>
                            <Text style={styles.artistPillText}>{name}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  {!music?.tracks?.length && log && (
                    <Text style={styles.noMusicText}>No listening data for this day.</Text>
                  )}
                </LinearGradient>
              </View>
            );
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {selectedDay !== null ? `${DAYS[selectedDay]}'s Vibe` : 'Log Mood'}
            </Text>
            <View style={styles.moodGrid}>
              {MOODS.map(mood => (
                <TouchableOpacity
                  key={mood.value}
                  style={[
                    styles.moodOption,
                    selectedMood?.value === mood.value && {
                      backgroundColor: getMoodColor(mood.value) + '33',
                      borderColor: getMoodColor(mood.value),
                    },
                  ]}
                  onPress={() => setSelectedMood(mood)}
                >
                  <Text style={styles.moodOptionEmoji}>{mood.emoji}</Text>
                  <Text style={styles.moodOptionLabel}>{mood.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note... (optional)"
              placeholderTextColor={COLORS.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={120}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveMood} style={{ flex: 1 }}>
                <LinearGradient
                  colors={[COLORS.accent, '#CC1144']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.saveBtn}
                >
                  <Text style={styles.saveBtnText}>Save Vibe</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingTop: 60, paddingHorizontal: SPACING.md },
  header: { marginBottom: SPACING.lg },
  title: { fontSize: FONTS.sizes.xxxl, fontWeight: FONTS.weights.black, color: COLORS.text, letterSpacing: -1 },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, marginTop: 4 },
  progressCard: { backgroundColor: COLORS.bgCard, borderRadius: 14, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.lg },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  progressLabel: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: FONTS.weights.medium },
  progressCount: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  progressBar: { height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  sectionTitle: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: FONTS.weights.bold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: SPACING.sm },
  calendar: { flexDirection: 'row', gap: 6, marginBottom: SPACING.md },
  dayCell: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', paddingVertical: SPACING.sm, paddingHorizontal: 2, minHeight: 80, justifyContent: 'center' },
  todayCell: { borderColor: COLORS.accent + '88' },
  dayLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: FONTS.weights.bold, letterSpacing: 1, marginBottom: 4 },
  dayEmoji: { fontSize: 18, marginBottom: 4 },
  dayMoodLabel: { fontSize: 7, fontWeight: FONTS.weights.medium, textAlign: 'center', letterSpacing: 0.5 },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyEmoji: { fontSize: 40, marginBottom: SPACING.sm },
  emptyText: { fontSize: FONTS.sizes.md, color: COLORS.text, marginBottom: 4 },
  emptyHint: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  dayLogCard: { borderRadius: 16, overflow: 'hidden', marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  dayLogGradient: { padding: SPACING.md },
  dayLogHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  dayLogAccent: { width: 3, height: 20, borderRadius: 2 },
  dayLogDay: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.text, flex: 1 },
  moodBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  moodBadgeEmoji: { fontSize: 16 },
  moodBadgeLabel: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
  addMoodBtn: { backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.border },
  addMoodBtnText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  dayLogNote: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontStyle: 'italic', marginBottom: SPACING.sm, paddingLeft: SPACING.sm },
  musicSection: { marginTop: SPACING.sm },
  musicSectionLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: FONTS.weights.bold, letterSpacing: 1.5, marginBottom: SPACING.sm },
  miniTrackRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 8 },
  miniTrackImg: { width: 36, height: 36, borderRadius: 6 },
  miniTrackImgFallback: { backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  miniTrackInfo: { flex: 1 },
  miniTrackName: { fontSize: FONTS.sizes.xs, color: COLORS.text, fontWeight: FONTS.weights.medium },
  miniTrackArtist: { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  artistSection: { marginTop: SPACING.sm },
  artistPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  artistPill: { backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.border },
  artistPillText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  noMusicText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontStyle: 'italic', marginTop: SPACING.sm },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalSheet: { backgroundColor: COLORS.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.text, marginBottom: SPACING.md },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: SPACING.md },
  moodOption: { width: (width - SPACING.lg * 2 - 30) / 3, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', paddingVertical: SPACING.md },
  moodOptionEmoji: { fontSize: 28, marginBottom: 4 },
  moodOptionLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  noteInput: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, color: COLORS.text, fontSize: FONTS.sizes.sm, marginBottom: SPACING.md, minHeight: 60 },
  modalActions: { flexDirection: 'row', gap: SPACING.sm },
  cancelBtn: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 50, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.md },
  cancelBtnText: { color: COLORS.textMuted, fontWeight: FONTS.weights.medium },
  saveBtn: { borderRadius: 50, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.md },
  saveBtnText: { color: COLORS.white, fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.md },
});