try { require('dotenv').config(); } catch (_) {}

module.exports = {
  expo: {
    name: "BeatWrap!",
    slug: "beatwrap",
    owner: "suryask",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#0A0A0F",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.beatwrap.app",
      infoPlist: {
        NSMicrophoneUsageDescription: "BeatWrap does not use the microphone.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0A0A0F",
      },
      package: "com.beatwrap.app",
      minSdkVersion: 26,
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "com.beatwrap.app",
              host: "redirect",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    scheme: "beatwrap",
    plugins: ["expo-secure-store"],
    extra: {
      SPOTIFY_CLIENT_ID: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID,
      BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL,
      GROQ_API_KEY: process.env.EXPO_PUBLIC_GROQ_API_KEY,
      eas: {
        projectId: "41e11ca8-ecb6-48dd-8965-df244cb423d5",
      },
    },
  },
};