import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { COLORS, FONTS, SPACING } from '../utils/constants';

export default function UsernameScreen() {
  const { setUsername } = useAuth();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState(null); // 'checking' | 'available' | 'taken' | 'invalid'
  const [saving, setSaving] = useState(false);
  const checkTimer = useRef(null);
  const shake = useRef(new Animated.Value(0)).current;

  const handleChange = (text) => {
    const clean = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setValue(clean);
    setStatus(null);
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (clean.length < 3) return;
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) { setStatus('invalid'); return; }

    setStatus('checking');
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await apiService.checkUsername(clean);
        setStatus(res.available ? 'available' : 'taken');
      } catch {
        setStatus(null);
      }
    }, 500);
  };

  const doShake = () => {
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleSubmit = async () => {
    if (status !== 'available' || value.length < 3) { doShake(); return; }
    setSaving(true);
    try {
      const res = await apiService.setUsername(value);
      if (res.success) {
        await setUsername(res.user); // updates user in AuthContext → App.js re-renders
      }
    } catch (e) {
      const msg = e?.response?.data?.error || 'Something went wrong';
      setStatus(msg.includes('taken') ? 'taken' : 'invalid');
      doShake();
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = () => {
    if (status === 'available') return COLORS.green;
    if (status === 'taken' || status === 'invalid') return COLORS.accent;
    return COLORS.textMuted;
  };

  const getStatusText = () => {
    if (status === 'checking') return 'Checking...';
    if (status === 'available') return '✓ Available';
    if (status === 'taken') return '✕ Already taken';
    if (status === 'invalid') return 'Letters, numbers and _ only (3-20 chars)';
    if (value.length > 0 && value.length < 3) return 'At least 3 characters';
    return 'This is how friends will find you';
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0A0F', '#12121E', '#0A0A0F']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.blob1} />

      <View style={styles.content}>
        <Text style={styles.emoji}>🎵</Text>
        <Text style={styles.title}>Pick your username</Text>
        <Text style={styles.subtitle}>
          Friends will find you with @username.{'\n'}You can't change this later.
        </Text>

        <Animated.View style={[styles.inputWrap, { transform: [{ translateX: shake }] }]}>
          <Text style={styles.atSign}>@</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={handleChange}
            placeholder="yourname"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            autoFocus
          />
          {status === 'checking' && <ActivityIndicator size="small" color={COLORS.accent} />}
        </Animated.View>

        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>

        <TouchableOpacity
          style={[styles.btn, status !== 'available' && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={status !== 'available' || saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.btnText}>Let's go →</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  blob1: { position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: COLORS.accent + '10', top: -100, left: -100 },
  content: { flex: 1, paddingHorizontal: SPACING.xl, justifyContent: 'center', gap: SPACING.md },
  emoji: { fontSize: 52, textAlign: 'center', marginBottom: SPACING.sm },
  title: { fontSize: FONTS.sizes.xxxl, fontWeight: FONTS.weights.black, color: COLORS.text, textAlign: 'center', letterSpacing: -1 },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.md },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgCard, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: 16, paddingHorizontal: SPACING.md, gap: 4,
  },
  atSign: { fontSize: FONTS.sizes.xl, color: COLORS.accent, fontWeight: FONTS.weights.bold },
  input: { flex: 1, fontSize: FONTS.sizes.xl, color: COLORS.text, paddingVertical: SPACING.md, fontWeight: FONTS.weights.medium },
  statusText: { fontSize: FONTS.sizes.xs, textAlign: 'center', minHeight: 18 },
  btn: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: SPACING.sm },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#000', fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },
});