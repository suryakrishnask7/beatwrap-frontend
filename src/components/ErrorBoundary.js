import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Top-level error boundary that catches any unhandled JS errors in the
 * component tree (including render-time crashes from corrupted state).
 *
 * Instead of a white screen, this shows a recovery UI that lets the
 * user clear potentially corrupted caches and restart cleanly.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Unhandled crash:', error, errorInfo);
  }

  handleRecover = async () => {
    // Nuke all potentially corrupted cache keys
    const CACHE_KEYS = [
      'weekly_wrap', 'prev_weekly_wrap', 'mood_logs', 'daily_music',
      'daily_music_last_fetch', 'friends_list', 'friend_requests',
      'my_top_tracks', 'notifications_last_gen_date',
    ];
    try {
      await AsyncStorage.multiRemove(CACHE_KEYS);
    } catch {}
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>🎵</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            BeatWrap hit an unexpected error. This is usually caused by corrupted cached data.
          </Text>
          <Text style={styles.errorText}>
            {String(this.state.error?.message || this.state.error || '').slice(0, 200)}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={this.handleRecover}>
            <Text style={styles.btnText}>Clear Cache & Recover</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#F0F0FF', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#9090B0', textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  errorText: { fontSize: 11, color: '#FF336688', textAlign: 'center', marginBottom: 24, fontFamily: 'monospace' },
  btn: {
    backgroundColor: '#FF3366',
    borderRadius: 50,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
