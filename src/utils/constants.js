export const COLORS = {
  bg: '#0A0A0F',
  bgCard: '#111118',
  bgElevated: '#1A1A26',
  surface: '#1E1E2E',
  surfaceHigh: '#252538',
  accent: '#FF3366',
  accentSoft: '#FF336622',
  accentGlow: '#FF336644',
  gold: '#FFD700',
  goldSoft: '#FFD70022',
  violet: '#8B5CF6',
  violetSoft: '#8B5CF622',
  cyan: '#06B6D4',
  cyanSoft: '#06B6D422',
  green: '#10B981',
  greenSoft: '#10B98122',
  text: '#F0F0FF',
  textMuted: '#9090B0',
  textDim: '#5050708',
  border: '#2A2A40',
  borderGlow: '#FF336633',
  white: '#FFFFFF',
};

export const FONTS = {
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
    xxxl: 36,
    display: 48,
  },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '900',
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const MOODS = [
  { emoji: '🔥', label: 'Fired Up', value: 'fired_up' },
  { emoji: '😌', label: 'Chill', value: 'chill' },
  { emoji: '🌙', label: 'Midnight', value: 'midnight' },
  { emoji: '⚡', label: 'Electric', value: 'electric' },
  { emoji: '💭', label: 'Reflective', value: 'reflective' },
  { emoji: '🎭', label: 'Dramatic', value: 'dramatic' },
];

export const SPOTIFY_SCOPES = [
  'user-top-read',
  'user-read-recently-played',
  'user-read-currently-playing',
  'user-read-private',
  'user-read-email',
].join(' ');
