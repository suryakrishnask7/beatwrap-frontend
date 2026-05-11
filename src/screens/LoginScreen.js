import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { COLORS, FONTS, SPACING } from '../utils/constants';


export default function LoginScreen() {
  const { signIn, enterGuestMode } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signIn();
    } catch (e) {
      console.error('Sign in error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0A0F', '#12121E', '#0A0A0F']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <View style={styles.content}>
        <View style={styles.logoSection}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImage} />
          <Text style={styles.logoText}>BeatWrap<Text style={styles.logoBang}>!</Text></Text>
          <Text style={styles.tagline}>Your week in music. Reimagined.</Text>
        </View>

        <View style={styles.features}>
          {[
            { icon: '🎭', text: 'AI Tamil character matching' },
            { icon: '📊', text: 'Weekly listening insights' },
            { icon: '⚡', text: 'Vibe match with friends' },
            { icon: '💬', text: 'Share tracks via DMs' },
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.spotifyBtn}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.spotifyBtnText}>♫  Continue with Spotify</Text>
            }
          </TouchableOpacity>


        </View>

        <Text style={styles.legal}>
          BeatWrap reads your listening history.{'\n'}It never modifies your playlists or follows.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  blob1: { position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: COLORS.accent + '12', top: -100, left: -100 },
  blob2: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: COLORS.violet + '10', bottom: -50, right: -80 },
  content: { flex: 1, paddingHorizontal: SPACING.lg, justifyContent: 'center', gap: SPACING.xl },
  logoSection: { alignItems: 'center', gap: 8 },
  logoImage: { width: 100, height: 100, marginBottom: 12 },
  logoText: { fontWeight: FONTS.weights.black, fontSize: 52, color: COLORS.text, letterSpacing: -2 },
  logoBang: { color: COLORS.accent },
  tagline: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center' },
  features: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: SPACING.lg, gap: SPACING.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  featureIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  featureText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, flex: 1 },
  buttonGroup: { gap: SPACING.sm },
  spotifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1DB954', borderRadius: 14, paddingVertical: 16 },
  spotifyBtnText: { color: '#000', fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  guestBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  guestBtnText: { color: COLORS.textMuted, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.medium },
  guestHint: { textAlign: 'center', fontSize: FONTS.sizes.xs, color: COLORS.textMuted, opacity: 0.6 },
  legal: { textAlign: 'center', fontSize: 11, color: COLORS.textMuted, opacity: 0.5, lineHeight: 18 },
});