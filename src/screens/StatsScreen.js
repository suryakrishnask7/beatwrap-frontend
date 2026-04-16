import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RadialProgress, CompareBar } from '../components/Charts';
import { COLORS, FONTS, SPACING } from '../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// Fallback only used when there is genuinely no previous week data at all
const EMPTY_PREV_STATS = {
  explorationIndex: null,
  discoveryRate: null,
  replayFrequency: null,
  estimatedMinutes: null,
  topGenres: [],
};

export default function StatsScreen() {
  const [currentStats, setCurrentStats] = useState(null);
  const [prevStats, setPrevStats] = useState(EMPTY_PREV_STATS);
  const [wrap, setWrap] = useState(null);
  const [prevWrap, setPrevWrap] = useState(null);
  const [hasPrevData, setHasPrevData] = useState(false);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      // Load current week
      const cached = await AsyncStorage.getItem('weekly_wrap');
      if (cached) {
        const { stats, wrap: w } = JSON.parse(cached);
        setCurrentStats(stats);
        setWrap(w);
      }

      // Load previous week — saved by HomeScreen when a new week starts
      const prevCached = await AsyncStorage.getItem('prev_weekly_wrap');
      if (prevCached) {
        const { stats: ps, wrap: pw } = JSON.parse(prevCached);
        if (ps) {
          setPrevStats({
            explorationIndex: ps.explorationIndex ?? null,
            discoveryRate: ps.discoveryRate ?? null,
            replayFrequency: ps.replayFrequency ?? null,
            estimatedMinutes: ps.estimatedMinutes ?? null,
            topGenres: ps.topGenres || [],
          });
          setPrevWrap(pw);
          setHasPrevData(true);
        }
      }
    } catch (e) {
      console.error('StatsScreen loadStats error:', e);
    }
  };

  // Returns null if either value is missing (no prev data yet)
  const getDelta = (curr, prev) => {
    if (curr == null || prev == null) return null;
    return Math.round(curr - prev);
  };

  const metrics = currentStats ? [
    {
      label: 'Exploration Index',
      current: currentStats.explorationIndex || 0,
      prev: prevStats.explorationIndex,
      unit: '/100', emoji: '🔭', color: COLORS.violet,
      desc: 'How adventurous your listening was', max: 100,
    },
    {
      label: 'Discovery Rate',
      current: currentStats.discoveryRate || 0,
      prev: prevStats.discoveryRate,
      unit: '%', emoji: '✨', color: COLORS.cyan,
      desc: 'New artists you explored', max: 100,
    },
    {
      label: 'Replay Frequency',
      current: currentStats.replayFrequency || 0,
      prev: prevStats.replayFrequency,
      unit: '%', emoji: '🔁', color: COLORS.gold,
      higherIsBetter: false,
      desc: 'Tracks played more than once', max: 100,
    },
    {
      label: 'Est. Minutes',
      current: currentStats.estimatedMinutes || 0,
      prev: prevStats.estimatedMinutes,
      unit: ' min', emoji: '⏱', color: COLORS.green,
      desc: 'Total listening time this week', max: 2000,
    },
  ] : [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Stats</Text>
          <Text style={styles.subtitle}>This week vs last week.</Text>
        </View>

        {/* VS card */}
        <View style={styles.compCard}>
          <LinearGradient colors={['#0D0D22', '#1A1A2E']} style={styles.compGradient}>
            <View style={styles.compRow}>
              <View style={styles.compSide}>
                <Text style={styles.compWeekLabel}>LAST WEEK</Text>
                <Text style={styles.compWeekTitle}>
                  {hasPrevData ? (prevWrap?.week_label || 'Previous') : 'No data yet'}
                </Text>
              </View>
              <View style={styles.compDivider}>
                <Text style={styles.compVS}>VS</Text>
              </View>
              <View style={[styles.compSide, { alignItems: 'flex-end' }]}>
                <Text style={styles.compWeekLabel}>THIS WEEK</Text>
                <Text style={[styles.compWeekTitle, { color: COLORS.accent }]}>
                  {wrap?.week_label || 'Current'}
                </Text>
              </View>
            </View>
            {!hasPrevData && (
              <Text style={styles.noPrevHint}>
                Last week's baseline will appear after your second weekly wrap.
              </Text>
            )}
          </LinearGradient>
        </View>

        {/* Radial glance */}
        {currentStats && (
          <>
            <Text style={styles.sectionTitle}>AT A GLANCE</Text>
            <View style={styles.radialRow}>
              <View style={styles.radialItem}>
                <RadialProgress value={currentStats.explorationIndex || 0} max={100} color={COLORS.violet} size={90} label="explore" />
                <Text style={styles.radialItemLabel}>Exploration</Text>
              </View>
              <View style={styles.radialItem}>
                <RadialProgress value={currentStats.discoveryRate || 0} max={100} color={COLORS.cyan} size={90} label="disc%" />
                <Text style={styles.radialItemLabel}>Discovery</Text>
              </View>
              <View style={styles.radialItem}>
                <RadialProgress value={currentStats.replayFrequency || 0} max={100} color={COLORS.gold} size={90} label="replay%" />
                <Text style={styles.radialItemLabel}>Replay</Text>
              </View>
            </View>
          </>
        )}

        {/* Metric cards */}
        <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>WEEK COMPARISON</Text>
        {metrics.map((metric, i) => {
          const delta = getDelta(metric.current, metric.prev);
          const isPositive = metric.higherIsBetter === false
            ? (delta ?? 0) < 0
            : (delta ?? 0) > 0;
          const prevDisplay = metric.prev != null ? `${metric.prev}${metric.unit}` : '—';

          return (
            <View key={i} style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricEmoji}>{metric.emoji}</Text>
                <View style={styles.metricInfo}>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                  <Text style={styles.metricDesc}>{metric.desc}</Text>
                </View>
                <View style={styles.metricValues}>
                  <Text style={[styles.metricCurrent, { color: metric.color }]}>
                    {metric.current}{metric.unit}
                  </Text>
                  {delta !== null ? (
                    <Text style={[styles.metricDelta, {
                      color: isPositive ? COLORS.green : delta === 0 ? COLORS.textMuted : COLORS.accent,
                    }]}>
                      {delta > 0 ? '↑' : delta < 0 ? '↓' : '—'} {Math.abs(delta)}
                    </Text>
                  ) : (
                    <Text style={styles.metricDeltaNone}>vs —</Text>
                  )}
                </View>
              </View>
              <View style={styles.barSection}>
                <View style={styles.barLegendRow}>
                  <View style={[styles.legendDot, { backgroundColor: metric.color }]} />
                  <Text style={styles.legendText}>This week</Text>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.border }]} />
                  <Text style={styles.legendText}>
                    Last week {metric.prev != null ? `(${prevDisplay})` : '(no data)'}
                  </Text>
                </View>
                <CompareBar
                  thisWeek={metric.current}
                  lastWeek={metric.prev ?? 0}
                  color={metric.color}
                  maxVal={metric.max}
                />
              </View>
            </View>
          );
        })}

        {/* Genre map */}
        {currentStats?.topGenres?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>GENRE MAP</Text>
            {currentStats.topGenres.map((g, i) => {
              const pct = Math.max(8, (g.count / (currentStats.topGenres[0].count || 1)) * 100);
              const color = [COLORS.accent, COLORS.violet, COLORS.cyan, COLORS.gold, COLORS.green][i] || COLORS.textMuted;
              return (
                <View key={i} style={styles.genreCompRow}>
                  <Text style={styles.genreRank}>#{i + 1}</Text>
                  <Text style={styles.genreCompName} numberOfLines={1}>{g.genre}</Text>
                  <View style={styles.genreBarOuter}>
                    <LinearGradient
                      colors={[color, color + '88']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[styles.genreBarFill, { width: `${pct}%` }]}
                    />
                  </View>
                  <Text style={[styles.genreCount, { color }]}>{g.count}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Stability card */}
        {currentStats && (
          <View style={styles.stabilityCard}>
            <LinearGradient colors={['#0D1A0D', '#0A0A0F']} style={styles.stabilityGradient}>
              <Text style={styles.stabilityLabel}>LISTENING STABILITY</Text>
              <View style={styles.stabilityRow}>
                <Text style={styles.stabilityEmoji}>
                  {currentStats.explorationIndex > 70 ? '🔥' : currentStats.explorationIndex > 40 ? '⚡' : '😌'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stabilityTitle}>
                    {currentStats.explorationIndex > 70
                      ? 'Explorer Mode'
                      : currentStats.explorationIndex > 40
                        ? 'Balanced Listener'
                        : 'Comfort Zone'}
                  </Text>
                  <Text style={styles.stabilityDesc}>
                    {currentStats.explorationIndex > 70
                      ? 'You branched out hard this week.'
                      : currentStats.explorationIndex > 40
                        ? 'Mix of new and familiar this week.'
                        : "Sticking to what you know — and that's fine."}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingTop: 60, paddingHorizontal: SPACING.md },
  header: { marginBottom: SPACING.lg },
  title: { fontSize: FONTS.sizes.xxxl, fontWeight: FONTS.weights.black, color: COLORS.text, letterSpacing: -1 },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, marginTop: 4 },
  compCard: { borderRadius: 16, overflow: 'hidden', marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  compGradient: { padding: SPACING.lg },
  compRow: { flexDirection: 'row', alignItems: 'center' },
  compSide: { flex: 1 },
  compWeekLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: FONTS.weights.bold, letterSpacing: 2, marginBottom: 4 },
  compWeekTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.text },
  compDivider: { paddingHorizontal: SPACING.md },
  compVS: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: FONTS.weights.bold },
  noPrevHint: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.md, textAlign: 'center', opacity: 0.7 },
  sectionTitle: {
    fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: FONTS.weights.bold,
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: SPACING.sm,
  },
  radialRow: {
    flexDirection: 'row', justifyContent: 'space-around', backgroundColor: COLORS.bgCard,
    borderRadius: 16, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.lg,
  },
  radialItem: { alignItems: 'center', gap: 8 },
  radialItemLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  metricCard: {
    backgroundColor: COLORS.bgCard, borderRadius: 14, padding: SPACING.md,
    marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  metricHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  metricEmoji: { fontSize: 24 },
  metricInfo: { flex: 1 },
  metricLabel: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: FONTS.weights.medium },
  metricDesc: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  metricValues: { alignItems: 'flex-end' },
  metricCurrent: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.black },
  metricDelta: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.medium },
  metricDeltaNone: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, opacity: 0.5 },
  barSection: { gap: 6 },
  barLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginRight: 8 },
  section: { marginBottom: SPACING.lg },
  genreCompRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  genreRank: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, width: 22 },
  genreCompName: { width: 90, fontSize: FONTS.sizes.xs, color: COLORS.text, textTransform: 'capitalize' },
  genreBarOuter: { flex: 1, height: 8, backgroundColor: COLORS.surface, borderRadius: 4, overflow: 'hidden' },
  genreBarFill: { height: '100%', borderRadius: 4 },
  genreCount: { width: 20, fontSize: FONTS.sizes.xs, textAlign: 'right', fontWeight: FONTS.weights.bold },
  stabilityCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.green + '33', marginBottom: SPACING.lg },
  stabilityGradient: { padding: SPACING.md },
  stabilityLabel: { fontSize: 9, color: COLORS.green, fontWeight: FONTS.weights.bold, letterSpacing: 2, marginBottom: SPACING.sm },
  stabilityRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  stabilityEmoji: { fontSize: 36 },
  stabilityTitle: { fontSize: FONTS.sizes.md, color: COLORS.text, fontWeight: FONTS.weights.bold, marginBottom: 4 },
  stabilityDesc: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, lineHeight: 18 },
});