import Constants from 'expo-constants';

const runtimeExtra =
  Constants.expoConfig?.extra ||
  Constants.manifest?.extra ||
  Constants.manifest2?.extra?.expoClient?.extra ||
  {};

export const getRuntimeConfig = () => ({
  SPOTIFY_CLIENT_ID:
    runtimeExtra.SPOTIFY_CLIENT_ID ||
    process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ||
    '',
  BACKEND_URL:
    runtimeExtra.BACKEND_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    'https://beatwrap-backend.onrender.com',
  GROQ_API_KEY:
    runtimeExtra.GROQ_API_KEY ||
    process.env.EXPO_PUBLIC_GROQ_API_KEY ||
    '',
});
