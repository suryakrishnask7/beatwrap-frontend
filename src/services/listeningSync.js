/**
 * listeningSync.js
 *
 * Orchestrates all listening data syncs:
 *  - Full sync:        week pagination → absolute /sync → sets baseline
 *  - Incremental sync: after-cursor   → $inc /incremental → adds delta
 *  - Scheduler:        runs every 60 min while app is foreground
 *                      + catch-up on AppState change to 'active'
 *
 * Key: 'listening_last_sync' in AsyncStorage = Unix ms of last processed play.
 * On week rollover (new weekKey), the key is cleared so full sync re-runs.
 */

import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spotifyService } from './spotifyService';
import { apiService } from './apiService';

const SYNC_KEY     = 'listening_last_sync';
const WEEK_KEY_KEY = 'listening_sync_week';
const HOUR_MS      = 60 * 60 * 1000;
const TWO_DAYS_MS  = 48 * HOUR_MS;
const MIN_INTERVAL = 5 * 60 * 1000; // don't re-sync within 5 min

let _intervalId      = null;
let _appStateHandler = null;
let _token           = null;
let _lastRunAt       = 0;

function getCurrentWeekKey() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ── Full sync: paginate entire week, set absolute values ─────────────────────
export async function runFullSync(token) {
  try {
    const weekKey = getCurrentWeekKey();
    console.log('[listeningSync] full sync start', weekKey);

    const data = await spotifyService.getWeekData(token);
    const now  = Date.now();

    // Save sync cursor = now (incremental syncs pick up from here)
    await AsyncStorage.setItem(SYNC_KEY, String(now));
    await AsyncStorage.setItem(WEEK_KEY_KEY, weekKey);
    _lastRunAt = now;

    // POST absolute values to backend
    await apiService.incrementalListeningSync({
      weekKey,
      addMinutes:      data.totalMinutes,
      dailyMinutes:    data.dailyMinutes,
      dailyTopTracks:  data.dailyTopTracks,
      trackPlayCounts: data.trackPlayCounts,
      isFullSync: true, // backend uses /sync (absolute) not /incremental ($inc)
    });

    console.log(`[listeningSync] full sync done: ${data.totalMinutes} min`);
    return data;
  } catch (e) {
    console.warn('[listeningSync] full sync error:', e?.message);
    return null;
  }
}

// ── Incremental sync: fetch only new plays since last cursor ─────────────────
export async function runIncrementalSync(token) {
  // Throttle — don't run within 5 minutes of last sync
  if (Date.now() - _lastRunAt < MIN_INTERVAL) return null;

  try {
    const weekKey       = getCurrentWeekKey();
    const storedWeekKey = await AsyncStorage.getItem(WEEK_KEY_KEY);
    const lastSyncRaw   = await AsyncStorage.getItem(SYNC_KEY);

    // Week rolled over → full sync instead
    if (!lastSyncRaw || storedWeekKey !== weekKey) {
      return runFullSync(token);
    }

    const lastSyncTs = parseInt(lastSyncRaw);
    const gap        = Date.now() - lastSyncTs;

    // Gap > 48h → full sync catches everything reliably
    if (gap > TWO_DAYS_MS) {
      return runFullSync(token);
    }

    // Fetch only plays since last cursor
    const items = await spotifyService.getIncrementalPlays(token, lastSyncTs);
    if (!items || items.length === 0) {
      console.log('[listeningSync] incremental: 0 new plays');
      _lastRunAt = Date.now();
      return null;
    }

    const data = spotifyService.processPlayItems(items, lastSyncTs);

    // Advance cursor to newest play's timestamp
    const newCursor = data.newestPlayedAt || Date.now();
    await AsyncStorage.setItem(SYNC_KEY, String(newCursor));
    _lastRunAt = Date.now();

    if (data.totalMinutes === 0) return null;

    // POST deltas to backend ($inc)
    const result = await apiService.incrementalListeningSync({
      weekKey,
      addMinutes:      data.totalMinutes,
      dailyMinutes:    data.dailyMinutes,
      dailyTopTracks:  data.dailyTopTracks,
      trackPlayCounts: data.trackPlayCounts,
      isFullSync: false,
    });

    console.log(`[listeningSync] incremental +${data.totalMinutes} min, total=${result?.totalMinutes}`);
    return data;
  } catch (e) {
    console.warn('[listeningSync] incremental error:', e?.message);
    return null;
  }
}

// ── Scheduler ────────────────────────────────────────────────────────────────
export function startSyncScheduler(token) {
  _token = token;

  // Run immediately on start (catches gap since last open)
  runIncrementalSync(token);

  // Every 60 minutes while foreground
  if (_intervalId) clearInterval(_intervalId);
  _intervalId = setInterval(() => {
    if (_token) runIncrementalSync(_token);
  }, HOUR_MS);

  // Catch-up when app comes back to foreground
  if (_appStateHandler) _appStateHandler.remove();
  _appStateHandler = AppState.addEventListener('change', (state) => {
    if (state === 'active' && _token) {
      runIncrementalSync(_token);
    }
  });
}

export function stopSyncScheduler() {
  if (_intervalId)      { clearInterval(_intervalId); _intervalId = null; }
  if (_appStateHandler) { _appStateHandler.remove(); _appStateHandler = null; }
  _token = null;
}

// ── Get stored daily data for display (MoodScreen etc.) ──────────────────────
export async function getStoredDailyData() {
  try {
    const weekKey = getCurrentWeekKey();
    const res = await apiService.getListeningHistory(weekKey);
    return res?.found ? res : null;
  } catch { return null; }
}
