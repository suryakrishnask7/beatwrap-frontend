import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Dimensions, Image, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { spotifyService } from '../services/spotifyService';
import { apiService } from '../services/apiService';
import { MOODS } from '../utils/constants';

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

const MOOD_COLORS = {
  fired_up: '#FF3366',
  chill:    '#06B6D4',
  midnight: '#8B5CF6',
  electric: '#FFD700',
  reflective: '#9090B0',
  dramatic: '#FF6B6B',
};

function getMoodColor(value) {
  return MOOD_COLORS[value] || '#2A2A40';
}

// Animated day cell
function DayCell({ day, index, log, isToday, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const hasLog = !!log;
  const color = hasLog ? getMoodColor(log.value) : isToday ? '#FF3366' : '#2A2A40';

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true, tension: 200, friction: 10 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }),
    ]).start();
    onPress(index);
  };

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.dayCell,
          { borderColor: color },
          hasLog && { backgroundColor: color + '14' },
          isToday && !hasLog && { borderColor: '#FF336644' },
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={[styles.dayLabel, isToday && { color: '#FF3366' }]}>{day}</Text>
        <Text style={styles.dayEmoji}>{hasLog ? log.emoji : isToday ? '＋' : '·'}</Text>
        {hasLog && (
          <Text style={[styles.dayMoodLabel, { color }]} numberOfLines={1}>{log.label}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MoodScreen() {
  const { spotifyToken, user } = useAuth();
  const [moodLogs, setMoodLogs] = useState({});
  const [dailyMusic, setDailyMusic] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  const [note, setNote] = useState('');
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const day = new Date().getDay();
    setCurrentDayIndex(day === 0 ? 6 : day - 1);
    loadMoods();
    fetchDailyMusic();
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [user?._id]);

  const loadMoods = async () => {
    try {
      const stored = await AsyncStorage.getItem('mood_logs');
      if (stored) setMoodLogs(JSON.parse(stored));
    } catch {}

    if (!user?._id || user.isGuest) return;
    try {
      const res = await apiService.getWeekMoods(getCurrentWeekKey());
      if (res.moods && Object.keys(res.moods).length > 0) {
        setMoodLogs(res.moods);
        await AsyncStorage.setItem('mood_logs', JSON.stringify(res.moods));
      } else {
        setMoodLogs({});
        await AsyncStorage.setItem('mood_logs', JSON.stringify({}));
      }
    } catch {}
  };

  const fetchDailyMusic = async () => {
    if (!spotifyToken) return;
    const lastFetchRaw = await AsyncStorage.getItem('daily_music_last_fetch');
    const lastFetch = lastFetchRaw ? parseInt(lastFetchRaw) : 0;
    const cached = await AsyncStorage.getItem('daily_music');
    if (cached) setDailyMusic(JSON.parse(cached));
    if (Date.now() - lastFetch < 30 * 60 * 1000 && cached) return;

    try {
      const recent = await spotifyService.getRecentlyPlayed(spotifyToken, 50);
      const existingRaw = await AsyncStorage.getItem('daily_music');
      const byDay = existingRaw ? { ...JSON.parse(existingRaw) } : {};
      recent.forEach(item => {
        const playedAt = new Date(item.played_at);
        const now = new Date();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        monday.setHours(0, 0, 0, 0);
        if (playedAt < monday) return;
        const dayOfWeek = playedAt.getDay();
        const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        if (!byDay[dayIdx]) byDay[dayIdx] = { tracks: [], artistMap: {} };
        if (byDay[dayIdx].tracks.length < 5) {
          if (!byDay[dayIdx].tracks.find(t => t.id === item.track.id))
            byDay[dayIdx].tracks.push(item.track);
        }
        item.track.artists?.forEach(a => { byDay[dayIdx].artistMap[a.id] = a.name; });
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
    } catch {}
  };

  const saveMood = async () => {
    if (!selectedMood || selectedDay === null) return;
    const updated = {
      ...moodLogs,
      [selectedDay]: {
        emoji: selectedMood.emoji, label: selectedMood.label,
        value: selectedMood.value, note, timestamp: Date.now(),
      },
    };
    setMoodLogs(updated);
    await AsyncStorage.setItem('mood_logs', JSON.stringify(updated));
    if (user?._id && !user.isGuest) {
      try {
        await apiService.saveMood(getCurrentWeekKey(), selectedDay, DAYS[selectedDay],
          selectedMood.emoji, selectedMood.label, selectedMood.value, note);
      } catch {}
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

  const weekMoods = DAYS.map((day, i) => ({ day, index: i, log: moodLogs[i], music: dailyMusic[i] }));
  const loggedCount = Object.keys(moodLogs).length;
  const progressPct = (loggedCount / 7) * 100;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Vibe Tracker</Text>
          <Text style={styles.subtitle}>Log your mood, feel the pattern.</Text>
        </View>

        {/* ── Progress Card ── */}
        <View style={styles.progressCard}>
          <LinearGradient colors={['#111118', '#0A0A14']} style={styles.progressGrad}>
            <View style={styles.progressRow}>
              <View>
                <Text style={styles.progressSup}>THIS WEEK</Text>
                <Text style={styles.progressMain}>{loggedCount}<Text style={styles.progressOf}>/7</Text></Text>
              </View>
              <View style={styles.progressRight}>
                <Text style={styles.progressPct}>{Math.round(progressPct)}%</Text>
                <Text style={styles.progressLabel}>logged</Text>
              </View>
            </View>
            {/* Progress bar */}
            <View style={styles.progressBarOuter}>
              <LinearGradient
                colors={['#FF3366', '#8B5CF6']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.progressBarFill, { width: `${progressPct}%` }]}
              />
            </View>
            {/* Day dots */}
            <View style={styles.dotRow}>
              {DAYS.map((d, i) => {
                const log = moodLogs[i];
                const color = log ? getMoodColor(log.value) : '#2A2A40';
                return (
                  <View key={i} style={[styles.dot, { backgroundColor: color }]} />
                );
              })}
            </View>
          </LinearGradient>
        </View>

        {/* ── Week Calendar ── */}
        <Text style={styles.sectionLabel}>WEEK CALENDAR</Text>
        <View style={styles.calendar}>
          {weekMoods.map(({ day, index, log }) => (
            <DayCell
              key={index}
              day={day}
              index={index}
              log={log}
              isToday={index === currentDayIndex}
              onPress={openModal}
            />
          ))}
        </View>

        {/* ── Daily Log ── */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>DAILY LOG</Text>

        {weekMoods.every(m => !m.log && !m.music?.tracks?.length) ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎭</Text>
            <Text style={styles.emptyText}>No logs yet this week</Text>
            <Text style={styles.emptyHint}>Tap any day above to log your vibe.</Text>
          </View>
        ) : (
          weekMoods.map(({ day, index, log, music }) => {
            if (!log && !music?.tracks?.length) return null;
            const moodColor = log ? getMoodColor(log.value) : '#2A2A40';
            return (
              <View key={index} style={styles.dayLogCard}>
                <LinearGradient colors={['#111118', '#0C0C14']} style={styles.dayLogGrad}>
                  {/* Colored left accent */}
                  <View style={[styles.dayLogAccentBar, { backgroundColor: moodColor }]} />

                  <View style={styles.dayLogInner}>
                    {/* Header row */}
                    <View style={styles.dayLogHeaderRow}>
                      <Text style={styles.dayLogDayText}>{day}</Text>
                      {log ? (
                        <TouchableOpacity
                          style={[styles.moodBadge, { borderColor: moodColor + '66', backgroundColor: moodColor + '18' }]}
                          onPress={() => openModal(index)}
                        >
                          <Text style={styles.moodBadgeEmoji}>{log.emoji}</Text>
                          <Text style={[styles.moodBadgeLabel, { color: moodColor }]}>{log.label}</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={styles.addMoodBtn} onPress={() => openModal(index)}>
                          <Text style={styles.addMoodBtnText}>＋ Log mood</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {log?.note ? (
                      <Text style={styles.dayLogNote}>"{log.note}"</Text>
                    ) : null}

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
                  </View>
                </LinearGradient>
              </View>
            );
          })
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Mood Logger Modal ── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {selectedDay !== null ? `${DAYS[selectedDay]}'s Vibe` : 'Log Mood'}
            </Text>

            {/* Mood grid */}
            <View style={styles.moodGrid}>
              {MOODS.map(mood => {
                const color = getMoodColor(mood.value);
                const isSelected = selectedMood?.value === mood.value;
                return (
                  <TouchableOpacity
                    key={mood.value}
                    style={[
                      styles.moodOption,
                      isSelected && {
                        backgroundColor: color + '22',
                        borderColor: color,
                      },
                    ]}
                    onPress={() => setSelectedMood(mood)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.moodOptionEmoji}>{mood.emoji}</Text>
                    <Text style={[styles.moodOptionLabel, isSelected && { color }]}>{mood.label}</Text>
                    {isSelected && <View style={[styles.moodSelectedDot, { backgroundColor: color }]} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Note input */}
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note... (optional)"
              placeholderTextColor="#505070"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={120}
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setModalVisible(false); setNote(''); setSelectedMood(null); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveMood} style={{ flex: 1 }} disabled={!selectedMood}>
                <LinearGradient
                  colors={selectedMood ? ['#FF3366', '#CC1144'] : ['#1A1A28', '#1A1A28']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.saveBtn}
                >
                  <Text style={[styles.saveBtnText, !selectedMood && { color: '#505070' }]}>
                    Save Vibe
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { paddingTop: 58, paddingHorizontal: 20 },

  // Header
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#F0F0FF', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#9090B0', marginTop: 4 },

  // Progress card
  progressCard: { borderRadius: 18, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: '#2A2A40' },
  progressGrad: { padding: 20 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  progressSup: { fontSize: 9, color: '#9090B0', fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  progressMain: { fontSize: 36, fontWeight: '900', color: '#F0F0FF', letterSpacing: -1 },
  progressOf: { fontSize: 18, fontWeight: '600', color: '#9090B0' },
  progressRight: { alignItems: 'flex-end' },
  progressPct: { fontSize: 22, fontWeight: '900', color: '#FF3366' },
  progressLabel: { fontSize: 11, color: '#9090B0', fontWeight: '600' },
  progressBarOuter: { height: 4, backgroundColor: '#1A1A28', borderRadius: 2, overflow: 'hidden', marginBottom: 12 },
  progressBarFill: { height: '100%', borderRadius: 2 },
  dotRow: { flexDirection: 'row', gap: 6, justifyContent: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4 },

  // Section label
  sectionLabel: { fontSize: 9, color: '#9090B0', fontWeight: '700', letterSpacing: 2, marginBottom: 12 },

  // Calendar
  calendar: { flexDirection: 'row', gap: 5, marginBottom: 8 },
  dayCell: {
    flex: 1, backgroundColor: '#111118', borderRadius: 12, borderWidth: 1.5,
    borderColor: '#2A2A40', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 2, minHeight: 78, justifyContent: 'center',
  },
  dayLabel: { fontSize: 8, color: '#9090B0', fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  dayEmoji: { fontSize: 18, marginBottom: 4 },
  dayMoodLabel: { fontSize: 7, fontWeight: '700', textAlign: 'center', letterSpacing: 0.3 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#F0F0FF', marginBottom: 6 },
  emptyHint: { fontSize: 12, color: '#9090B0', textAlign: 'center' },

  // Day log card
  dayLogCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 10, borderWidth: 1, borderColor: '#2A2A40', flexDirection: 'row' },
  dayLogGrad: { flex: 1, flexDirection: 'row' },
  dayLogAccentBar: { width: 3, borderRadius: 2 },
  dayLogInner: { flex: 1, padding: 14 },
  dayLogHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  dayLogDayText: { fontSize: 14, fontWeight: '800', color: '#F0F0FF' },
  moodBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  moodBadgeEmoji: { fontSize: 14 },
  moodBadgeLabel: { fontSize: 11, fontWeight: '700' },
  addMoodBtn: { backgroundColor: '#1A1A28', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#2A2A40' },
  addMoodBtnText: { fontSize: 11, color: '#9090B0', fontWeight: '600' },
  dayLogNote: { fontSize: 11, color: '#9090B0', fontStyle: 'italic', marginBottom: 8, lineHeight: 17 },

  // Music in log
  musicSection: { marginTop: 6 },
  musicSectionLabel: { fontSize: 8, color: '#9090B0', fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  miniTrackRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  miniTrackImg: { width: 34, height: 34, borderRadius: 6 },
  miniTrackImgFallback: { backgroundColor: '#1A1A28', alignItems: 'center', justifyContent: 'center' },
  miniTrackInfo: { flex: 1 },
  miniTrackName: { fontSize: 11, color: '#F0F0FF', fontWeight: '600' },
  miniTrackArtist: { fontSize: 10, color: '#9090B0', marginTop: 1 },
  artistSection: { marginTop: 8 },
  artistPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  artistPill: { backgroundColor: '#1A1A28', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: '#2A2A40' },
  artistPillText: { fontSize: 10, color: '#9090B0' },
  noMusicText: { fontSize: 10, color: '#505070', fontStyle: 'italic', marginTop: 6 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' },
  modalSheet: {
    backgroundColor: '#111118', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 44, borderWidth: 1, borderColor: '#2A2A40',
  },
  modalHandle: { width: 36, height: 4, backgroundColor: '#2A2A40', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#F0F0FF', letterSpacing: -0.5, marginBottom: 20 },

  // Mood picker
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  moodOption: {
    width: (width - 48 - 20) / 3,
    backgroundColor: '#0A0A0F', borderRadius: 14, borderWidth: 1.5,
    borderColor: '#2A2A40', alignItems: 'center', paddingVertical: 14, position: 'relative',
  },
  moodOptionEmoji: { fontSize: 26, marginBottom: 5 },
  moodOptionLabel: { fontSize: 11, color: '#9090B0', fontWeight: '600' },
  moodSelectedDot: { position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: 3 },

  noteInput: {
    backgroundColor: '#0A0A0F', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A40',
    padding: 14, color: '#F0F0FF', fontSize: 13, marginBottom: 18, minHeight: 66, lineHeight: 20,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, backgroundColor: '#1A1A28', borderRadius: 50, alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderWidth: 1, borderColor: '#2A2A40' },
  cancelBtnText: { color: '#9090B0', fontWeight: '600', fontSize: 14 },
  saveBtn: { borderRadius: 50, alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});