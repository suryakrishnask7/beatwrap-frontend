import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Dimensions, Animated, TouchableOpacity, TextInput, RefreshControl
} from 'react-native';
import Reanimated, { useSharedValue, useAnimatedProps, withTiming, runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/apiService';

const { width } = Dimensions.get('window');
const CARD_W = width - 40;

// ── Helpers ────────────────────────────────────────────────────────────────────

function getCurrentWeekKey() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getLastWeekKey() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const AnimatedTextInput = Reanimated.createAnimatedComponent(TextInput);

function ArcProgress({ value = 0, max = 100, color = '#FF3366', size = 100, label = '', delta = null }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(value, { duration: 1000 });
  }, [value]);

  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;
  const deltaColor = delta > 0 ? '#10B981' : delta < 0 ? '#FF3366' : '#9090B0';

  const animatedCircleProps = useAnimatedProps(() => {
    const p = Math.min(progress.value / max, 1);
    const strokeDash = circumference * p;
    return {
      strokeDasharray: `${strokeDash} ${circumference}`
    };
  });

  const animatedTextProps = useAnimatedProps(() => {
    return {
      text: `${Math.round(progress.value)}%`,
    };
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient colors={[color + '22', color + '11']} style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2 }} />
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle cx={cx} cy={cy} r={radius} stroke={color + '22'} strokeWidth={8} fill="none" />
          <AnimatedCircle 
            cx={cx} cy={cy} r={radius} stroke={color} strokeWidth={8} fill="none"
            strokeLinecap="round" rotation="-90" origin={`${cx}, ${cy}`}
            animatedProps={animatedCircleProps}
          />
        </Svg>
        <View style={{ alignItems: 'center' }}>
          <AnimatedTextInput 
            editable={false}
            animatedProps={animatedTextProps}
            style={{ fontSize: 18, fontWeight: '900', color, letterSpacing: -0.5, textAlign: 'center', padding: 0 }}
          />
          {delta !== null && (
            <Text style={{ fontSize: 10, color: deltaColor, fontWeight: '700' }}>{delta > 0 ? '+' : ''}{delta}</Text>
          )}
        </View>
      </View>
      <Text style={{ fontSize: 11, color: '#9090B0', marginTop: 8, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function Sparkline({ color = '#FF3366', height = 36 }) {
  const w = CARD_W - 48;
  const points = [0, 0.6, 0.3, 0.8, 0.5, 0.4, 0.9, 0.3, 0.7, 0.5, 0.85, 0.4, 0.6, 0.75, 0.45, 0.9, 0.55, 0.7, 0.8, 0.5];
  const step = w / (points.length - 1);
  let d = '';
  points.forEach((p, i) => {
    const x = i * step;
    const y = height - p * height;
    d += (i === 0 ? 'M' : 'L') + `${x.toFixed(1)},${y.toFixed(1)} `;
  });
  const fillD = d + `L${w},${height} L0,${height} Z`;
  return (
    <Svg width={w} height={height}>
      <Defs>
        <SvgGrad id="sg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.3" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgGrad>
      </Defs>
      <Path d={fillD} fill="url(#sg)" />
      <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function VSWave() {
  const w = CARD_W - 40;
  const h = 48;
  const leftPts  = [0,0.5, 0.15,0.3, 0.3,0.7, 0.45,0.4, 0.6,0.8, 0.75,0.35, 0.9,0.6, 1.0,0.45];
  const rightPts = [0,0.45, 0.12,0.75, 0.28,0.35, 0.44,0.85, 0.58,0.4, 0.72,0.7, 0.88,0.3, 1.0,0.55];
  const buildPath = pts => {
    let d = '';
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i] * w;
      const y = h - pts[i + 1] * h;
      d += (i === 0 ? 'M' : 'L') + `${x.toFixed(1)},${y.toFixed(1)} `;
    }
    return d;
  };
  return (
    <Svg width={w} height={h} style={{ marginTop: 16 }}>
      <Path d={buildPath(leftPts)}  stroke="#8B5CF6" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.7} />
      <Path d={buildPath(rightPts)} stroke="#FF3366" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.7} />
    </Svg>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const [currentStats, setCurrentStats] = useState(null);
  const [prevStats, setPrevStats]       = useState(null);
  const [wrap, setWrap]                 = useState(null);
  const [hasPrevData, setHasPrevData]   = useState(false);
  const [refreshing, setRefreshing]     = useState(false);

  // Live comparison: { currentMinutes, lastMinutes, percentageChange }
  const [comparison, setComparison] = useState(null);
  const [compLoading, setCompLoading] = useState(true);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const pollingRef = useRef(null);

  useEffect(() => {
    loadStats();
    loadComparison();
    pollingRef.current = setInterval(loadComparison, 30000);
    return () => clearInterval(pollingRef.current);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadComparison()]);
    setRefreshing(false);
  };
  const loadStats = async () => {
    try {
      // Current week from cache
      const cached = await AsyncStorage.getItem('weekly_wrap');
      if (cached) {
        let data = null;
        try { data = JSON.parse(cached); } catch (e) {
          console.error('[StatsScreen] Corrupt weekly_wrap cache, clearing:', e);
          await AsyncStorage.removeItem('weekly_wrap');
        }
        if (data && data.stats) { 
          setCurrentStats(data.stats); 
          setWrap(data.wrap); 
        }
      }

      // Previous week: try local cache first
      const prevCached = await AsyncStorage.getItem('prev_weekly_wrap');
      if (prevCached) {
        let data = null;
        try {
          data = JSON.parse(prevCached);
        } catch (e) {
          console.error('Error parsing prev_weekly_wrap:', e);
        }
        
        if (data && data.stats && (data.stats.explorationIndex || data.stats.estimatedMinutes)) {
          setPrevStats(data.stats);
          setHasPrevData(true);
        }
      }

      // If no local prev, try fetching last week's wrap from API
      if (!prevCached) {
        try {
          const lastKey = getLastWeekKey();
          const cloud = await apiService.getWrapFromCloud(lastKey);
          if (cloud?.found && cloud.stats) {
            setPrevStats(cloud.stats);
            setHasPrevData(true);
            // Cache it so it persists across sessions
            await AsyncStorage.setItem('prev_weekly_wrap', JSON.stringify(cloud));
            // Trigger a re-comparison now that we have prev data
            loadComparison();
          }
        } catch (e) {
          console.log('[Stats] Cloud fetch for prev week failed:', e.message);
        }
      }
    } catch {}

    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  };

  // ── Load comparison (live minutes this week vs last week) ─────────────────
  const loadComparison = async () => {
    setCompLoading(true);
    try {
      // Primary: call the /api/wrap/compare endpoint
      const data = await apiService.getWrapComparison();
      if (data && (data.currentMinutes > 0 || data.lastMinutes > 0)) {
        setComparison(data);
        setCompLoading(false);
        return;
      }
    } catch {}

    // Fallback: build from local cache
    try {
      const cached = await AsyncStorage.getItem('weekly_wrap');
      const prevCached = await AsyncStorage.getItem('prev_weekly_wrap');
      
      let currData = null, prevData = null;
      try { currData = cached ? JSON.parse(cached) : null; } catch { await AsyncStorage.removeItem('weekly_wrap'); }
      try { prevData = prevCached ? JSON.parse(prevCached) : null; } catch { await AsyncStorage.removeItem('prev_weekly_wrap'); }

      const currMins = currData?.stats?.estimatedMinutes || 0;
      const lastMins = prevData?.stats?.estimatedMinutes || 0;
      let percentageChange = 0;
      if (lastMins > 0) {
        percentageChange = Math.round(((currMins - lastMins) / lastMins) * 100);
      } else if (currMins > 0) {
        percentageChange = 100;
      }
      setComparison({ currentMinutes: currMins, lastMinutes: lastMins, percentageChange });
    } catch {}
    setCompLoading(false);
  };

  const getDelta = (curr, prev) =>
    (curr == null || prev == null) ? null : Math.round(curr - prev);

  const metrics = currentStats ? [
    { label: 'Exploration Index', current: currentStats.explorationIndex || 0, prev: prevStats?.explorationIndex, unit: '/100', emoji: '🔭', color: '#FF6B35', desc: 'How adventurous your listening was',   max: 100 },
    { label: 'Discovery Rate',    current: currentStats.discoveryRate    || 0, prev: prevStats?.discoveryRate,    unit: '%',    emoji: '✦',  color: '#8B5CF6', desc: 'New artists you explored',            max: 100 },
    { label: 'Replay Frequency',  current: currentStats.replayFrequency  || 0, prev: prevStats?.replayFrequency,  unit: '%',    emoji: '↻',  color: '#06B6D4', desc: 'Tracks played more than once', higherIsBetter: false, max: 100 },
    { label: 'Minutes Listened',  current: comparison?.currentMinutes    || currentStats.estimatedMinutes || 0,
                                  prev:    comparison?.lastMinutes        || prevStats?.estimatedMinutes,
                                  unit: ' min', emoji: '⏱', color: '#10B981', desc: 'Total listening time this week', max: 2000 },
  ] : [];

  const hasCurrentMins = comparison?.currentMinutes > 0 || (currentStats?.estimatedMinutes > 0);
  const hasLastMins    = comparison?.lastMinutes    > 0 || (prevStats?.estimatedMinutes    > 0);
  const displayCurrMins = comparison?.currentMinutes || currentStats?.estimatedMinutes || 0;
  const displayLastMins = comparison?.lastMinutes    || prevStats?.estimatedMinutes    || 0;
  const pctChange = comparison?.percentageChange ??
    (displayLastMins > 0 ? Math.round(((displayCurrMins - displayLastMins) / displayLastMins) * 100) : displayCurrMins > 0 ? 100 : 0);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF3366" />}
      >

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Stats</Text>
          <Text style={styles.subtitle}>Your listening, beautifully broken down.</Text>
        </View>

        {/* ── VS Card ── */}
        <View style={styles.vsCard}>
          <LinearGradient colors={['#111118', '#0A0A14']} style={styles.vsCardGrad}>
            <View style={styles.vsRow}>
              {/* Last week */}
              <View style={{ flex: 1 }}>
                <Text style={styles.vsWeekLabel}>LAST WEEK</Text>
                {hasLastMins
                  ? <Text style={styles.vsWeekTitle}>{displayLastMins} min</Text>
                  : hasPrevData
                    ? <Text style={[styles.vsWeekTitle, { color: '#9090B0', fontSize: 13 }]}>Wrap generated</Text>
                    : <Text style={[styles.vsWeekTitle, { color: '#505070', fontSize: 12 }]}>No data yet</Text>
                }
              </View>

              <View style={styles.vsBadge}>
                <Text style={styles.vsText}>VS</Text>
              </View>

              {/* This week */}
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.vsWeekLabel}>THIS WEEK</Text>
                {hasCurrentMins
                  ? <Text style={[styles.vsWeekTitle, { color: '#FF3366' }]}>{displayCurrMins} min</Text>
                  : <Text style={[styles.vsWeekTitle, { color: '#9090B0', fontSize: 12 }]}>Loading...</Text>
                }
              </View>
            </View>

            <VSWave />

            {/* Change pill — show when we have current data */}
            {hasCurrentMins && (
              <View style={styles.compareRow}>
                <View style={[
                  styles.changePill,
                  { backgroundColor: pctChange >= 0 ? '#10B98122' : '#FF336622',
                    borderColor:     pctChange >= 0 ? '#10B98155' : '#FF336655' }
                ]}>
                  <Text style={[styles.changeText, { color: pctChange >= 0 ? '#10B981' : '#FF3366' }]}>
                    {pctChange >= 0 ? '↑' : '↓'} {Math.abs(pctChange)}%
                    {!hasLastMins ? '  (first week with data)' : '  vs last week'}
                  </Text>
                </View>
              </View>
            )}

            {!hasCurrentMins && !compLoading && (
              <Text style={styles.noPrevHint}>Open the app after listening to see your minutes.</Text>
            )}
          </LinearGradient>
        </View>

        {/* ── At a glance ── */}
        {currentStats && (
          <>
            <Text style={styles.sectionLabel}>At a glance</Text>
            <View style={styles.glanceCard}>
              <LinearGradient colors={['#111118', '#0A0A14']} style={styles.glanceGrad}>
                <View style={styles.glanceRow}>
                  <ArcProgress value={currentStats.explorationIndex || 0} max={100} color="#FF6B35" size={100} label="Exploration" delta={getDelta(currentStats.explorationIndex, prevStats?.explorationIndex)} />
                  <ArcProgress value={currentStats.discoveryRate    || 0} max={100} color="#8B5CF6" size={100} label="Discovery"   delta={getDelta(currentStats.discoveryRate,    prevStats?.discoveryRate)} />
                  <ArcProgress value={currentStats.replayFrequency  || 0} max={100} color="#06B6D4" size={100} label="Replay"      delta={getDelta(currentStats.replayFrequency,  prevStats?.replayFrequency)} />
                </View>
                {!hasPrevData && (
                  <Text style={[styles.noPrevHint, { marginTop: 16 }]}>
                    Deltas appear after your second week of data.
                  </Text>
                )}
              </LinearGradient>
            </View>
          </>
        )}

        {/* ── Week comparison metrics ── */}
        {metrics.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Week comparison</Text>
            {metrics.map((metric, i) => {
              const delta = getDelta(metric.current, metric.prev);
              const isPositive = metric.higherIsBetter === false ? (delta ?? 0) < 0 : (delta ?? 0) > 0;
              const deltaColor = delta === null ? '#505070' : isPositive ? '#10B981' : delta === 0 ? '#9090B0' : '#FF3366';

              return (
                <View key={i} style={styles.metricCard}>
                  <View style={styles.metricTop}>
                    <Text style={styles.metricEmoji}>{metric.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.metricLabel}>{metric.label}</Text>
                      <Text style={styles.metricDesc}>{metric.desc}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.metricValue, { color: metric.color }]}>{metric.current}{metric.unit}</Text>
                      {delta !== null ? (
                        <Text style={[styles.metricDelta, { color: deltaColor }]}>
                          {delta > 0 ? '↑' : delta < 0 ? '↓' : '—'} {Math.abs(delta)} vs last week
                        </Text>
                      ) : (
                        <Text style={styles.metricDeltaNone}>no prev data</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.sparklineWrap}>
                    <Sparkline color={metric.color} height={36} />
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ── Genre Map ── */}
        {currentStats?.topGenres?.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Genre Map</Text>
            <View style={styles.genreCard}>
              {currentStats.topGenres.map((g, i) => {
                const pct = Math.max(8, (g.count / (currentStats.topGenres[0].count || 1)) * 100);
                const colors = ['#FF3366', '#8B5CF6', '#06B6D4', '#FFD700', '#10B981'];
                const color = colors[i] || '#9090B0';
                return (
                  <View key={i} style={styles.genreRow}>
                    <Text style={styles.genreRank}>#{i + 1}</Text>
                    <Text style={styles.genreName} numberOfLines={1}>{g.genre}</Text>
                    <View style={styles.genreBarOuter}>
                      <LinearGradient colors={[color, color + '88']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.genreBarFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={[styles.genreCount, { color }]}>{g.count}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Listening Mode ── */}
        {currentStats && (
          <View style={styles.modeCard}>
            <LinearGradient colors={['#0D1A0D', '#0A0A0F']} style={styles.modeGrad}>
              <Text style={styles.modeLabel}>LISTENING MODE</Text>
              <View style={styles.modeRow}>
                <Text style={styles.modeEmoji}>
                  {(currentStats.explorationIndex || 0) > 70 ? '🔥' : (currentStats.explorationIndex || 0) > 40 ? '⚡' : '😌'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeTitle}>
                    {(currentStats.explorationIndex || 0) > 70 ? 'Explorer Mode' : (currentStats.explorationIndex || 0) > 40 ? 'Balanced Listener' : 'Comfort Zone'}
                  </Text>
                  <Text style={styles.modeDesc}>
                    {(currentStats.explorationIndex || 0) > 70 ? 'You branched out hard this week.' : (currentStats.explorationIndex || 0) > 40 ? 'Mix of new and familiar this week.' : "Sticking to what you know — and that's fine."}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Empty state */}
        {!currentStats && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>No stats yet</Text>
            <Text style={styles.emptyHint}>Your stats will appear after your first listening session this week.</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { paddingTop: 58, paddingHorizontal: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#F0F0FF', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#9090B0', marginTop: 4 },

  // VS Card
  vsCard: { borderRadius: 18, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: '#2A2A40' },
  vsCardGrad: { padding: 20 },
  vsRow: { flexDirection: 'row', alignItems: 'center' },
  vsWeekLabel: { fontSize: 9, color: '#9090B0', fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  vsWeekTitle: { fontSize: 18, fontWeight: '800', color: '#F0F0FF', letterSpacing: -0.3 },
  vsBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2A2A40', alignItems: 'center', justifyContent: 'center', marginHorizontal: 12 },
  vsText: { fontSize: 10, color: '#9090B0', fontWeight: '800' },
  noPrevHint: { fontSize: 11, color: '#9090B0', textAlign: 'center', marginTop: 12, opacity: 0.7 },
  compareRow: { marginTop: 14, alignItems: 'center' },
  changePill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1 },
  changeText: { fontSize: 12, fontWeight: '700' },

  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#F0F0FF', marginBottom: 12 },

  // Glance card
  glanceCard: { borderRadius: 18, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: '#2A2A40' },
  glanceGrad: { padding: 20 },
  glanceRow: { flexDirection: 'row', justifyContent: 'space-around' },

  // Metric cards
  metricCard: { backgroundColor: '#111118', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#2A2A40' },
  metricTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  metricEmoji: { fontSize: 22, width: 32 },
  metricLabel: { fontSize: 14, color: '#F0F0FF', fontWeight: '600' },
  metricDesc: { fontSize: 11, color: '#9090B0', marginTop: 2 },
  metricValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  metricDelta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  metricDeltaNone: { fontSize: 11, color: '#505070' },
  sparklineWrap: { overflow: 'hidden' },

  // Genre
  genreCard: { backgroundColor: '#111118', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#2A2A40' },
  genreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  genreRank: { width: 22, fontSize: 11, color: '#9090B0', fontWeight: '600' },
  genreName: { width: 88, fontSize: 11, color: '#F0F0FF', textTransform: 'capitalize' },
  genreBarOuter: { flex: 1, height: 8, backgroundColor: '#1A1A28', borderRadius: 4, overflow: 'hidden' },
  genreBarFill: { height: '100%', borderRadius: 4 },
  genreCount: { width: 20, fontSize: 11, textAlign: 'right', fontWeight: '700' },

  // Mode card
  modeCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#10B98133' },
  modeGrad: { padding: 16 },
  modeLabel: { fontSize: 9, color: '#10B981', fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  modeEmoji: { fontSize: 36 },
  modeTitle: { fontSize: 15, color: '#F0F0FF', fontWeight: '700', marginBottom: 4 },
  modeDesc: { fontSize: 12, color: '#9090B0', lineHeight: 18 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#F0F0FF', marginBottom: 8 },
  emptyHint: { fontSize: 13, color: '#9090B0', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
});